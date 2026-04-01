const morgan = require('morgan');
const logger = require('../../utils/logger');

const morganStream = {
  write: (message) => logger.http(message.trim()),
};

const morganFormat = (tokens, req, res) => {
  const tenantId = req.tenant?.id || req.headers['x-tenant-id'] || '-';
  return [
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    tokens['response-time'](req, res) + 'ms',
    `tenant:${tenantId}`,
    `ip:${req.ip}`,
  ].join(' | ');
};

const httpLogger = morgan(morganFormat, { stream: morganStream });

module.exports = httpLogger;
