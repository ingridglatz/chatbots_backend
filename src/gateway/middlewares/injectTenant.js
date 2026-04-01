const { query } = require('../../models/db');
const { get, set } = require('../../models/redis');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

const TENANT_CACHE_TTL = 300;

const injectTenant = async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return next(AppError.unauthorized('Tenant não identificado.', 'TENANT_MISSING'));

    const cacheKey = `tenant:${tenantId}`;
    const cached = await get(cacheKey);
    if (cached) { req.tenant = cached; return next(); }

    const result = await query(
      `SELECT t.id, t.name, t.segment, t.plan, t.status,
              t.messages_this_month AS "messageCountThisMonth",
              t.created_at AS "createdAt",
              pl.max_bots AS "botLimit",
              pl.max_messages_per_month AS "messageLimit"
       FROM tenants t
       JOIN plans pl ON pl.id = t.plan
       WHERE t.id = $1 AND t.status != 'suspended'`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return next(AppError.forbidden('Tenant inativo ou não encontrado.', 'TENANT_NOT_FOUND'));
    }

    const tenant = result.rows[0];
    await set(cacheKey, tenant, TENANT_CACHE_TTL);
    req.tenant = tenant;
    next();
  } catch (err) {
    logger.error('Erro ao injetar contexto do tenant', { error: err.message });
    next(err);
  }
};

const invalidateTenantCache = async (tenantId) => {
  const { del } = require('../../models/redis');
  await del(`tenant:${tenantId}`);
};

module.exports = { injectTenant, invalidateTenantCache };
