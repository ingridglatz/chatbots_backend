class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, code = 'BAD_REQUEST', details = null) {
    return new AppError(message, 400, code, details);
  }
  static unauthorized(message = 'Não autorizado', code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }
  static forbidden(message = 'Acesso negado', code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }
  static notFound(message = 'Recurso não encontrado', code = 'NOT_FOUND') {
    return new AppError(message, 404, code);
  }
  static tooManyRequests(message = 'Muitas requisições. Tente novamente em breve.', code = 'RATE_LIMIT_EXCEEDED') {
    return new AppError(message, 429, code);
  }
  static planLimitReached(message = 'Limite do plano atingido. Faça upgrade para continuar.') {
    return new AppError(message, 402, 'PLAN_LIMIT_REACHED');
  }
}

module.exports = AppError;
