const { z } = require('zod');
const { get, set, getRedisClient } = require('../../models/redis');
const { query } = require('../../models/db');
const { success } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { getAIClient } = require('../../utils/aiClient');

const SESSION_TTL = 60 * 60;

const sendMessageSchema = z.object({
  botId: z.string().uuid('botId deve ser um UUID válido'),
  sessionId: z.string().min(1).max(100),
  message: z.string().min(1, 'Mensagem não pode ser vazia').max(2000),
});

exports.sendMessage = async (req, res, next) => {
  try {
    const body = sendMessageSchema.parse(req.body);
    const tenant = req.tenant;

    if (tenant.messageLimit !== null && tenant.messageCountThisMonth >= tenant.messageLimit) {
      throw AppError.planLimitReached();
    }

    const botResult = await query(
      `SELECT id, name, system_prompt, welcome_message, tone
       FROM bots WHERE id = $1 AND tenant_id = $2 AND active = true`,
      [body.botId, tenant.id]
    );
    if (botResult.rows.length === 0) throw AppError.notFound('Bot não encontrado ou inativo.', 'BOT_NOT_FOUND');

    const bot = botResult.rows[0];
    const sessionKey = `session:${tenant.id}:${body.botId}:${body.sessionId}`;
    const history = (await get(sessionKey)) || [];
    history.push({ role: 'user', content: body.message });

    // Usa chave do tenant se configurada, senão usa a da plataforma
    const tenantWithKeys = await query(
      'SELECT ai_provider, anthropic_api_key_enc, ai_model FROM tenants WHERE id = $1',
      [tenant.id]
    );
    const { client, model } = getAIClient(tenantWithKeys.rows[0] || {});

    const claudeResponse = await client.messages.create({
      model,
      max_tokens: 1024,
      system: bot.system_prompt || `Você é ${bot.name}, um assistente útil e prestativo.`,
      messages: history,
    });

    const assistantReply = claudeResponse.content[0].text;
    history.push({ role: 'assistant', content: assistantReply });
    await set(sessionKey, history, SESSION_TTL);

    query('UPDATE tenants SET messages_this_month = messages_this_month + 1 WHERE id = $1', [tenant.id])
      .catch((err) => logger.error('Erro ao incrementar contador de mensagens', { error: err.message }));

    res.json(success({ reply: assistantReply, sessionId: body.sessionId, usage: claudeResponse.usage }, 'Mensagem processada com sucesso'));
  } catch (err) { next(err); }
};

exports.getHistory = async (req, res, next) => {
  try {
    const { botId } = req.query;
    if (!botId) throw AppError.badRequest('botId é obrigatório.', 'BOT_ID_REQUIRED');
    const sessionKey = `session:${req.tenant.id}:${botId}:${req.params.sessionId}`;
    const history = (await get(sessionKey)) || [];
    res.json(success({ history, sessionId: req.params.sessionId }));
  } catch (err) { next(err); }
};

exports.clearSession = async (req, res, next) => {
  try {
    const { botId } = req.query;
    if (!botId) throw AppError.badRequest('botId é obrigatório.', 'BOT_ID_REQUIRED');
    const sessionKey = `session:${req.tenant.id}:${botId}:${req.params.sessionId}`;
    const redis = getRedisClient();
    await redis.del(sessionKey);
    res.json(success(null, 'Sessão encerrada com sucesso'));
  } catch (err) { next(err); }
};

exports.health = async (req, res, next) => {
  try {
    const { testConnection: redisTest } = require('../../models/redis');
    await redisTest();
    res.json(success({ status: 'ok', service: 'chat', redis: 'connected' }));
  } catch (err) { next(err); }
};
