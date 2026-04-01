const { query } = require("../../models/db");
const { success } = require("../../utils/response");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");

exports.listConversations = async (req, res, next) => {
  try {
    const { botId } = req.params;

    const botCheck = await query(
      "SELECT id FROM bots WHERE id = $1 AND tenant_id = $2",
      [botId, req.tenant.id],
    );
    if (!botCheck.rows.length) throw AppError.notFound("Bot não encontrado.");

    const result = await query(
      `SELECT c.id, c.phone, c.contact_name, c.status, c.last_message_at, c.created_at,
              (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
              (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND role = 'user') AS total_messages
       FROM conversations c
       WHERE c.bot_id = $1 AND c.tenant_id = $2
       ORDER BY
         CASE c.status WHEN 'waiting' THEN 0 WHEN 'human' THEN 1 ELSE 2 END,
         c.last_message_at DESC
       LIMIT 100`,
      [botId, req.tenant.id],
    );

    res.json(success({ conversations: result.rows }));
  } catch (err) {
    next(err);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    const convCheck = await query(
      "SELECT c.id, c.phone, c.contact_name, c.status, c.bot_id FROM conversations c WHERE c.id = $1 AND c.tenant_id = $2",
      [conversationId, req.tenant.id],
    );
    if (!convCheck.rows.length)
      throw AppError.notFound("Conversa não encontrada.");

    const conversation = convCheck.rows[0];

    const msgs = await query(
      "SELECT id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
      [conversationId],
    );

    res.json(success({ conversation, messages: msgs.rows }));
  } catch (err) {
    next(err);
  }
};

exports.takeOver = async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    const result = await query(
      `UPDATE conversations SET status = 'human'
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, phone, contact_name, status`,
      [conversationId, req.tenant.id],
    );
    if (!result.rows.length)
      throw AppError.notFound("Conversa não encontrada.");

    logger.info("Conversa assumida por operador", {
      conversationId,
      tenantId: req.tenant.id,
    });
    res.json(
      success(
        { conversation: result.rows[0] },
        "Controle assumido com sucesso",
      ),
    );
  } catch (err) {
    next(err);
  }
};

exports.releaseToBot = async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    const result = await query(
      `UPDATE conversations SET status = 'bot'
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, phone, contact_name, status`,
      [conversationId, req.tenant.id],
    );
    if (!result.rows.length)
      throw AppError.notFound("Conversa não encontrada.");

    logger.info("Conversa devolvida ao bot", {
      conversationId,
      tenantId: req.tenant.id,
    });
    res.json(
      success({ conversation: result.rows[0] }, "Bot reativado com sucesso"),
    );
  } catch (err) {
    next(err);
  }
};

exports.sendOperatorMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { message } = req.body;
    if (!message?.trim())
      throw AppError.badRequest("Mensagem não pode ser vazia.");

    const convResult = await query(
      `SELECT c.phone, c.bot_id, c.status, b.whatsapp_instance
       FROM conversations c
       JOIN bots b ON b.id = c.bot_id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [conversationId, req.tenant.id],
    );
    if (!convResult.rows.length)
      throw AppError.notFound("Conversa não encontrada.");

    const conv = convResult.rows[0];
    const remoteJid = `${conv.phone}@s.whatsapp.net`;

    const { sendText } = require("../chat/whatsappService");
    await sendText(conv.whatsapp_instance, remoteJid, message.trim());

    await query(
      "INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)",
      [conversationId, "operator", message.trim()],
    );

    await query(
      "UPDATE conversations SET last_message_at = NOW() WHERE id = $1",
      [conversationId],
    );

    res.json(success({ sent: true }, "Mensagem enviada"));
  } catch (err) {
    next(err);
  }
};
