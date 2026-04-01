const rateLimit = require('express-rate-limit');
const AppError = require('../../utils/AppError');

const LIMITS_BY_PLAN = {
  starter:  100,
  pro:      300,
  business: 1000,
  default:  60,
};

const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => next(AppError.tooManyRequests()),
  keyGenerator: (req) => req.ip,
});

const tenantLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: (req) => {
    const plan = req.user?.plan || req.tenant?.plan || 'default';
    return LIMITS_BY_PLAN[plan] ?? LIMITS_BY_PLAN.default;
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `tenant:${req.user?.tenantId || req.tenant?.id || req.ip}`,
  handler: (req, res, next) => next(AppError.tooManyRequests()),
  skip: (req) => req.headers['x-internal-call'] === process.env.INTERNAL_SECRET,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => next(AppError.tooManyRequests('Muitas tentativas. Tente novamente em 15 minutos.', 'AUTH_RATE_LIMIT')),
});

module.exports = { globalLimiter, tenantLimiter, authLimiter };
