const jwt = require('jsonwebtoken');
const AppError = require('../../utils/AppError');

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Token de autenticação não fornecido.');
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      tenantId: decoded.tenantId,
      role: decoded.role,
      plan: decoded.plan,
    };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err.name === 'TokenExpiredError') {
      return next(AppError.unauthorized('Token expirado. Faça login novamente.', 'TOKEN_EXPIRED'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(AppError.unauthorized('Token inválido.', 'TOKEN_INVALID'));
    }
    next(AppError.unauthorized('Falha na autenticação.'));
  }
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch { /* ignora */ }
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(AppError.forbidden('Permissão insuficiente para esta ação.', 'INSUFFICIENT_ROLE'));
  }
  next();
};

module.exports = { auth, optionalAuth, requireRole };
