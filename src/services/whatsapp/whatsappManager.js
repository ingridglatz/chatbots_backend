const { Client, LocalAuth } = require("whatsapp-web.js");
const path = require("path");
const os = require("os");
const { query } = require("../../models/db");
const { set, get } = require("../../models/redis");
const logger = require("../../utils/logger");

const AUTH_PATH = path.join(os.homedir(), ".chatbots-whatsapp-auth");
const clients = new Map();

const createClient = async (instanceId, botId) => {
  if (clients.has(instanceId)) {
    const existing = clients.get(instanceId);
    if (existing.status === "connected") return existing;
    try {
      await existing.client.destroy();
    } catch {}
    clients.delete(instanceId);
  }

  logger.info("Iniciando cliente WhatsApp", { instanceId, botId });

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: instanceId, dataPath: AUTH_PATH }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    },
  });

  const instance = { client, status: "initializing", qrCode: null, botId };
  clients.set(instanceId, instance);

  client.on("qr", async (qr) => {
    instance.qrCode = qr;
    instance.status = "qr_pending";
    logger.info("QR code gerado", { instanceId });
    await set(`whatsapp_qr:${instanceId}`, qr, 180).catch(() => {});
    await query("UPDATE bots SET whatsapp_connected = false WHERE id = $1", [
      botId,
    ]).catch(() => {});
  });

  client.on("loading_screen", (percent) => {
    instance.status = "loading";
    logger.debug("WhatsApp carregando", { instanceId, percent });
  });

  client.on("authenticated", () => {
    instance.status = "authenticated";
    logger.info("WhatsApp autenticado", { instanceId });
  });

  client.on("ready", async () => {
    instance.status = "connected";
    instance.qrCode = null;
    logger.info("WhatsApp conectado e pronto", { instanceId });
    await query("UPDATE bots SET whatsapp_connected = true WHERE id = $1", [
      botId,
    ]).catch(() => {});
  });

  client.on("disconnected", async (reason) => {
    instance.status = "disconnected";
    logger.warn("WhatsApp desconectado", { instanceId, reason });
    await query("UPDATE bots SET whatsapp_connected = false WHERE id = $1", [
      botId,
    ]).catch(() => {});
  });

  client.on("message", async (message) => {
    if (message.fromMe) return;
    if (message.from === "status@broadcast") return;
    if (message.isStatus) return;
    const chat = await message.getChat().catch(() => null);
    if (!chat || chat.isGroup) return;

    const payload = {
      instance: instanceId,
      event: "messages.upsert",
      data: {
        key: {
          remoteJid: message.from,
          fromMe: false,
          id: message.id._serialized,
        },
        message: {
          conversation: message.body,
        },
        pushName: message._data?.notifyName || "",
      },
    };

    const { processIncomingMessage } = require("../chat/whatsappService");
    processIncomingMessage(payload).catch((err) =>
      logger.error("Erro ao processar mensagem recebida", {
        instanceId,
        error: err.message,
      }),
    );
  });

  client.initialize().catch((err) => {
    logger.error("Erro ao inicializar cliente WhatsApp", {
      instanceId,
      error: err.message,
    });
    instance.status = "error";
  });

  return instance;
};

const getClientInstance = (instanceId) => clients.get(instanceId);

const getWAClient = (instanceId) => clients.get(instanceId)?.client || null;

const getQRCode = async (instanceId) => {
  const instance = clients.get(instanceId);
  if (instance?.qrCode) return instance.qrCode;
  return await get(`whatsapp_qr:${instanceId}`).catch(() => null);
};

const getStatus = (instanceId) => {
  return clients.get(instanceId)?.status || "not_initialized";
};

const disconnectClient = async (instanceId) => {
  const instance = clients.get(instanceId);
  if (!instance) return;
  try {
    await instance.client.destroy();
  } catch {}
  clients.delete(instanceId);
};

const initializeAllBots = async () => {
  try {
    const result = await query(
      "SELECT id, whatsapp_instance FROM bots WHERE active = true AND whatsapp_instance IS NOT NULL",
    );
    logger.info(`Inicializando ${result.rows.length} cliente(s) WhatsApp`);
    for (const bot of result.rows) {
      createClient(bot.whatsapp_instance, bot.id).catch((err) =>
        logger.error("Erro ao inicializar bot WhatsApp", {
          botId: bot.id,
          error: err.message,
        }),
      );
    }
  } catch (err) {
    logger.error("Erro ao buscar bots para inicializar WhatsApp", {
      error: err.message,
    });
  }
};

module.exports = {
  createClient,
  getClientInstance,
  getWAClient,
  getQRCode,
  getStatus,
  disconnectClient,
  initializeAllBots,
};
