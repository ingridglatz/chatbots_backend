const { query } = require("../../models/db");
const { get, set } = require("../../models/redis");
const logger = require("../../utils/logger");
const { getAIClient } = require("../../utils/aiClient");

const SESSION_TTL = 60 * 60;

const processingLocks = new Map();
const acquireLock = async (key) => {
  if (processingLocks.get(key)) return false;
  processingLocks.set(key, true);
  return true;
};
const releaseLock = (key) => processingLocks.delete(key);

const wantsHumanAgent = (text, phrasesConfig) => {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const phrases = (
    phrasesConfig ||
    "atendente,humano,pessoa,falar com alguem,quero atendimento,suporte humano"
  )
    .split(",")
    .map((p) =>
      p
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
    )
    .filter(Boolean);
  return phrases.some((phrase) => normalized.includes(phrase));
};

const sendText = async (instanceId, to, text) => {
  const { getWAClient } = require("../whatsapp/whatsappManager");
  const client = getWAClient(instanceId);
  if (!client) {
    logger.warn("Cliente WhatsApp não encontrado", { instanceId });
    return;
  }

  const chunks = splitLongMessage(text, 4000);
  for (const chunk of chunks) {
    await client.sendMessage(to, chunk);
    if (chunks.length > 1) await new Promise((r) => setTimeout(r, 600));
  }
};

const sendTyping = async (instanceId, to, durationMs = 2000) => {
  try {
    const { getWAClient } = require("../whatsapp/whatsappManager");
    const client = getWAClient(instanceId);
    if (!client) return;
    const chat = await client.getChatById(to);
    await chat.sendStateTyping();
    await new Promise((r) => setTimeout(r, durationMs));
    await chat.clearState();
  } catch (err) {
    logger.debug("Erro ao enviar typing indicator", { error: err.message });
  }
};

const markAsRead = async (instanceId, to) => {
  try {
    const { getWAClient } = require("../whatsapp/whatsappManager");
    const client = getWAClient(instanceId);
    if (!client) return;
    const chat = await client.getChatById(to);
    await chat.sendSeen();
  } catch (err) {
    logger.debug("Erro ao marcar como lida", { error: err.message });
  }
};

const upsertConversation = async (botId, tenantId, phone, contactName) => {
  const res = await query(
    `INSERT INTO conversations (bot_id, tenant_id, phone, contact_name, last_message_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (bot_id, phone) DO UPDATE
       SET last_message_at = NOW(),
           contact_name = COALESCE(NULLIF($4, ''), conversations.contact_name)
     RETURNING id, status`,
    [botId, tenantId, phone, contactName || ""],
  );
  return res.rows[0];
};

const saveMessage = async (conversationId, role, content) => {
  await query(
    "INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)",
    [conversationId, role, content],
  ).catch((err) =>
    logger.error("Erro ao salvar mensagem", { error: err.message }),
  );
};

const processIncomingMessage = async (payload) => {
  const { instance, data } = payload;
  const remoteJid = data?.key?.remoteJid;
  const text = extractMessageText(data);
  if (!text || data?.key?.fromMe) return;

  const contactName = data?.pushName || "";
  logger.info("WhatsApp: mensagem recebida", {
    instance,
    from: remoteJid,
    preview: text.substring(0, 60),
  });

  const botResult = await query(
    `SELECT b.id, b.name, b.system_prompt, b.tenant_id AS "tenantId",
            b.human_transfer_enabled AS "humanTransferEnabled",
            b.human_transfer_phrases AS "humanTransferPhrases",
            b.human_transfer_message AS "humanTransferMessage",
            t.plan, t.status AS "tenantStatus",
            t.messages_this_month AS "msgCount",
            t.ai_provider, t.anthropic_api_key_enc, t.ai_model,
            t.operator_whatsapp AS "operatorWhatsapp",
            pl.max_messages_per_month AS "msgLimit"
     FROM bots b
     JOIN tenants t ON t.id = b.tenant_id
     JOIN plans pl ON pl.id = t.plan
     WHERE b.whatsapp_instance = $1 AND b.active = true LIMIT 1`,
    [instance],
  );

  if (!botResult.rows.length) {
    logger.warn("WhatsApp: nenhum bot ativo para essa instância", { instance });
    return;
  }

  const bot = botResult.rows[0];
  if (bot.tenantStatus === "suspended") return;

  const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
  const lockKey = `${bot.id}:${phone}`;

  const locked = await acquireLock(lockKey);
  if (!locked) {
    logger.info("WhatsApp: mensagem descartada (já processando)", { phone });
    return;
  }

  try {
    const conversation = await upsertConversation(
      bot.id,
      bot.tenantId,
      phone,
      contactName,
    );

    const freshStatus = await query(
      "SELECT status FROM conversations WHERE id = $1",
      [conversation.id],
    );
    const currentStatus = freshStatus.rows[0]?.status || conversation.status;

    await saveMessage(conversation.id, "user", text);

    if (currentStatus === "human" || currentStatus === "waiting") {
      logger.info(`WhatsApp: conversa pausada (${currentStatus})`, {
        conversationId: conversation.id,
      });
      await markAsRead(instance, remoteJid);
      return;
    }

    if (
      bot.humanTransferEnabled !== false &&
      wantsHumanAgent(text, bot.humanTransferPhrases)
    ) {
      logger.info("WhatsApp: transferindo para atendente humano", {
        conversationId: conversation.id,
      });
      await query("UPDATE conversations SET status = $1 WHERE id = $2", [
        "waiting",
        conversation.id,
      ]);
      await markAsRead(instance, remoteJid);
      const transferMsg =
        bot.humanTransferMessage ||
        "Entendido! 👋 Vou chamar um atendente. Aguarde um momento!";
      await sendText(instance, remoteJid, transferMsg);
      await saveMessage(conversation.id, "system", transferMsg);

      // Notifica o operador via WhatsApp se tiver número cadastrado
      if (bot.operatorWhatsapp) {
        const operatorJid = `${bot.operatorWhatsapp}@s.whatsapp.net`;
        const contactDisplay = contactName || phone;
        const notifMsg = `🔔 *Novo atendimento solicitado!*\n\nCliente: *${contactDisplay}*\nBot: *${bot.name}*\n\nAcesse o painel para atender.`;
        sendText(instance, operatorJid, notifMsg).catch(() => {});
      }
      return;
    }

    if (bot.msgLimit !== -1 && bot.msgCount >= bot.msgLimit) {
      const limitMsg = "Desculpe, atingimos o limite de mensagens do mês. 😔";
      await sendText(instance, remoteJid, limitMsg);
      await saveMessage(conversation.id, "assistant", limitMsg);
      return;
    }

    await Promise.all([
      markAsRead(instance, remoteJid),
      sendTyping(instance, remoteJid, 2500),
    ]);

    const sessionKey = `whatsapp_session:${bot.tenantId}:${bot.id}:${phone}`;
    const history = (await get(sessionKey)) || [];
    history.push({ role: "user", content: text });
    const limitedHistory = history.slice(-40);

    let reply;
    try {
      const { client, model } = getAIClient(bot);
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        system:
          bot.system_prompt ||
          `Você é ${bot.name}, um assistente prestativo. Responda de forma concisa via WhatsApp.`,
        messages: limitedHistory,
      });
      reply = response.content[0].text;
    } catch (err) {
      logger.error("WhatsApp: erro ao chamar Claude", { error: err.message });
      await sendText(
        instance,
        remoteJid,
        "Desculpe, ocorreu um erro interno. Tente novamente em instantes.",
      );
      return;
    }

    limitedHistory.push({ role: "assistant", content: reply });
    await set(sessionKey, limitedHistory, SESSION_TTL);
    await saveMessage(conversation.id, "assistant", reply);

    query(
      "UPDATE tenants SET messages_this_month = messages_this_month + 1 WHERE id = $1",
      [bot.tenantId],
    ).catch((err) =>
      logger.error("WhatsApp: erro ao incrementar contador", {
        error: err.message,
      }),
    );

    await sendText(instance, remoteJid, reply);
    logger.info("WhatsApp: resposta enviada", {
      instance,
      to: remoteJid,
      botId: bot.id,
    });
  } finally {
    releaseLock(lockKey);
  }
};

const extractMessageText = (data) => {
  const msg = data?.message;
  if (!msg) return null;
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    null
  );
};

const splitLongMessage = (text, maxLen) => {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxLen;
    if (end < text.length) {
      const lastBreak = text.lastIndexOf("\n", end);
      if (lastBreak > start) end = lastBreak + 1;
      else {
        const lastSpace = text.lastIndexOf(" ", end);
        if (lastSpace > start) end = lastSpace + 1;
      }
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
};

module.exports = { processIncomingMessage, sendText, sendTyping, markAsRead };
