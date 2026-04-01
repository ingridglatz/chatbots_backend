const AppError = require('../../utils/AppError');
const { error: errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError && err.isOperational) {
    logger.warn('Erro operacional', {
      statusCode: err.statusCode, code: err.code, message: err.message,
      url: req.originalUrl, method: req.method, tenantId: req.tenant?.id || null,
    });
    return res.status(err.statusCode).json(errorResponse(err.message, err.code, err.details));
  }

  if (err.name === 'ZodError') {
    logger.warn('Erro de validação Zod', { issues: err.issues });
    return res.status(422).json(errorResponse('Dados inválidos na requisição.', 'VALIDATION_ERROR', err.issues));
  }

  if (err.code === '23505') return res.status(409).json(errorResponse('Registro já existe.', 'DUPLICATE_ENTRY'));
  if (err.code === '23503') return res.status(400).json(errorResponse('Referência inválida.', 'FOREIGN_KEY_VIOLATION'));

  logger.error('Erro não operacional (bug)', {
    message: err.message, stack: err.stack,
    url: req.originalUrl, method: req.method, tenantId: req.tenant?.id || null,
  });

  const isDev = process.env.NODE_ENV !== 'production';
  return res.status(500).json(
    errorResponse(isDev ? err.message : 'Erro interno do servidor.', 'INTERNAL_ERROR', isDev ? err.stack : null)
  );
};

module.exports = errorHandler;
