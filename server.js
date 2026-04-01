require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const logger = require('./src/utils/logger');
const gateway = require('./src/gateway');
const httpLogger = require('./src/gateway/middlewares/logger');
const { globalLimiter } = require('./src/gateway/middlewares/rateLimiter');
const errorHandler = require('./src/gateway/middlewares/errorHandler');

const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL', 'REDIS_URL'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  logger.error(`Variáveis de ambiente obrigatórias não definidas: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin não permitida: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-Internal-Call'],
}));

app.use(globalLimiter);

app.use((req, res, next) => {
  if (req.originalUrl === '/webhooks/stripe') return next();
  express.json({ limit: '1mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(httpLogger);
app.set('trust proxy', 1);
app.use(gateway);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, () => {
  logger.info(`🚀 ChatBots API rodando na porta ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  logger.info(`📋 Healthcheck: http://localhost:${PORT}/health`);
});

const gracefulShutdown = (signal) => {
  logger.info(`Sinal ${signal} recebido. Encerrando servidor...`);
  server.close(async () => {
    try {
      const { pool } = require('./src/models/db');
      const { getRedisClient } = require('./src/models/redis');
      await pool.end();
      await getRedisClient().quit();
    } catch (err) {
      logger.error('Erro ao encerrar conexões', { error: err.message });
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => { logger.error('Exceção não tratada', { error: err.message, stack: err.stack }); gracefulShutdown('uncaughtException'); });
process.on('unhandledRejection', (reason) => { logger.error('Promise rejeitada não tratada', { reason: String(reason) }); });

module.exports = app;
