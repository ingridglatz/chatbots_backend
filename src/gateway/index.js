const router = require('express').Router();
const { testConnection: dbTest } = require('../models/db');
const { testConnection: redisTest } = require('../models/redis');
const { success } = require('../utils/response');
const logger = require('../utils/logger');

router.get('/health', async (req, res) => {
  const startTime = Date.now();
  const [db, redis] = await Promise.allSettled([
    dbTest().catch((e) => { throw new Error(e.message); }),
    redisTest().catch((e) => { throw new Error(e.message); }),
  ]);
  const status = {
    status: 'ok',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    responseTimeMs: Date.now() - startTime,
    services: {
      database: db.status === 'fulfilled' ? 'connected' : `error: ${db.reason?.message}`,
      redis: redis.status === 'fulfilled' ? 'connected' : `error: ${redis.reason?.message}`,
    },
  };
  const isHealthy = db.status === 'fulfilled' && redis.status === 'fulfilled';
  if (!isHealthy) logger.error('Healthcheck falhou', status.services);
  res.status(isHealthy ? 200 : 503).json(success(status, isHealthy ? 'Todos os serviços operacionais' : 'Degradado'));
});

router.use('/api/chat',          require('../services/chat'));
router.use('/api/tenant',        require('../services/tenant'));
router.use('/api/billing',       require('../services/billing'));
router.use('/api/tenant',        require('../services/conversations'));
router.use('/webhooks',          require('../webhooks'));

router.use((req, res) => {
  res.status(404).json({ success: false, message: `Rota não encontrada: ${req.method} ${req.originalUrl}`, code: 'NOT_FOUND' });
});

module.exports = router;
