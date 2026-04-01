const success = (data = null, message = 'OK', meta = {}) => ({
  success: true,
  message,
  data,
  ...(Object.keys(meta).length > 0 && { meta }),
});

const error = (message = 'Erro interno', code = 'INTERNAL_ERROR', details = null) => ({
  success: false,
  message,
  code,
  ...(details && { details }),
});

const paginated = (data, { page, limit, total }) => ({
  success: true,
  data,
  meta: {
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / limit),
  },
});

module.exports = { success, error, paginated };
