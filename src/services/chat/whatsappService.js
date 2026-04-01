const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('../../models/db');
const { get, set } = require('../../models/redis');
const logger = require('../../utils/logger');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const EVOLUTION_URL = (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/$/, '');
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || '';
const SESSION_TTL = 60 * 60;
const MAX_RETRIES = 2;

const evolutionFetch = async (path, body, retries = 0) => {
  const url = `${EVOLUTION_URL}${path}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const text = await res.text(); throw new Error(`Evolution API ${res.status}: ${text}`); }
    return await res.json();
  } catch (err) {
    if (retries < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 800 * (retries + 1)));
      return evolutionFetch(path, body, retries + 1);
    }
    throw err;
  }
};

const sendText = async (instance, to, text) => {
  const chunks = splitLongMessage(text, 4000);
  for (const chunk of chunks) {
    await evolutionFetch(`/message/sendText/${instance}`, {
      number: to,
      options: { delay: 500, presence: 'composing' },
      textMessage: { text: chunk },
    });
    if (chunks.length > 1) await new Promise((r) => setTimeout(r, 600));
  }
};

const sendTyping = async (instance, to, durationMs = 2000) => {
  try {
    await evolutionFetch(`/chat/sendPresence/${instance}`, {
      number: to, options: { presence: 'composing', delay: durationMs },
    });
  } catch (err) { logger.debug('Erro ao enviar typing indicator', { error: err.message }); }
};

const markAsRead = async (instance, remoteJid, messageId) => {
  try {
    await evolutionFetch(`/chat/markMessageAsRead/${instance}`, {
      readMessages: [{ remoteJid, fromMe: false, id: messageId }],
    });
  } catch (err) { logger.debug('Erro ao marcar mensagem como lida', { error: err.message }); }
};

const processIncomingMessage = async (payload) => {
  const { instance, data } = payload;
  const remoteJid = data?.key?.remoteJid;
  const messageId = data?.key?.id;
  const text = extractMessageText(data);
  if (!text || data?.key?.fromMe) return;

  logger.info('WhatsApp: mensagem recebida', { instance, from: remoteJid, preview: text.substring(0, 60) });

  const botResult = await query(
    `SELECT b.id, b.name, b.system_prompt, b.tenant_id AS "tenantId",
            t.plan, t.status AS "tenantStatus",
            t.message_count_this_month AS "msgCount",
            pl.message_limit AS "msgLimit"
     FROM bots b
     JOIN tenants t ON t.id = b.tenant_id
     JOIN plans pl ON pl.name = t.plan
     WHERE b.whatsapp_instance = $1 AND b.active = true LIMIT 1`,
    [instance]
  );
  if (!botResult.rows.length) { logger.warn('WhatsApp: instância sem bot ativo', { instance }); return; }

  const bot = botResult.rows[0];
  if (bot.tenantStatus !== 'active') return;
  if (bot.msgLimit !== null && bot.msgCount >= bot.msgLimit) {
    await sendText(instance, remoteJid, 'Desculpe, atingimos o limite de mensagens do mês.');
    return;
  }

  await Promise.all([markAsRead(instance, remoteJid, messageId), sendTyping(instance, remoteJid, 2500)]);

  const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  const sessionKey = `whatsapp_session:${bot.tenantId}:${bot.id}:${phone}`;
  const history = (await get(sessionKey)) || [];
  history.push({ role: 'user', content: text });
  const limitedHistory = history.slice(-40);

  let reply;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: bot.system_prompt || `Você é ${bot.name}, um assistente prestativo. Responda de forma concisa via WhatsApp.`,
      messages: limitedHistory,
    });
    reply = response.content[0].text;
  } catch (err) {
    logger.error('WhatsApp: erro ao chamar Claude', { error: err.message });
    await sendText(instance, remoteJid, 'Desculpe, ocorreu um erro. Tente novamente em instantes.');
    return;
  }

  limitedHistory.push({ role: 'assistant', content: reply });
  await set(sessionKey, limitedHistory, SESSION_TTL);

  query('UPDATE tenants SET message_count_this_month = message_count_this_month + 1 WHERE id = $1', [bot.tenantId])
    .catch((err) => logger.error('WhatsApp: erro ao incrementar contador', { error: err.message }));

  await sendText(instance, remoteJid, reply);
  logger.info('WhatsApp: resposta enviada', { instance, to: remoteJid, botId: bot.id });
};

const extractMessageText = (data) => {
  const msg = data?.message;
  if (!msg) return null;
  return msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.documentMessage?.caption || null;
};

const splitLongMessage = (text, maxLen) => {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxLen;
    if (end < text.length) {
      const lastBreak = text.lastIndexOf('\n', end);
      if (lastBreak > start) end = lastBreak + 1;
      else { const lastSpace = text.lastIndexOf(' ', end); if (lastSpace > start) end = lastSpace + 1; }
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
};

module.exports = { processIncomingMessage, sendText, sendTyping, markAsRead };
