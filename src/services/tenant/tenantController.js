const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { query } = require('../../models/db');
const { testConnection: redisTest } = require('../../models/redis');
const { success } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2).max(150),
  segment: z.enum(['restaurant', 'health', 'ecommerce', 'services', 'other']),
});

const botSchema = z.object({
  name: z.string().min(2).max(100),
  systemPrompt: z.string().min(10).max(4000).optional(),
  welcomeMessage: z.string().max(500).optional(),
  tone: z.enum(['friendly', 'professional', 'casual', 'formal']).default('friendly'),
  active: z.boolean().default(true),
});

const generateToken = (user, tenant) => jwt.sign(
  { sub: user.id, email: user.email, tenantId: tenant.id, role: user.role, plan: tenant.plan },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

exports.register = async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) throw AppError.badRequest('E-mail já cadastrado.', 'EMAIL_TAKEN');

    const tenantId = uuidv4();
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(data.password, 12);
    const slug = data.companyName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + tenantId.split('-')[0];

    const { getClient } = require('../../models/db');
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO tenants (id, name, slug, segment, plan, status) VALUES ($1, $2, $3, $4, 'starter', 'trial')`, [tenantId, data.companyName, slug, data.segment]);
      await client.query(`INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, 'owner')`, [userId, tenantId, data.name, data.email, passwordHash]);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }

    const token = generateToken({ id: userId, email: data.email, role: 'owner' }, { id: tenantId, plan: 'starter' });
    logger.info('Novo tenant registrado', { tenantId, email: data.email });
    res.status(201).json(success({ token, tenantId, userId }, 'Conta criada com sucesso'));
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const result = await query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, t.id AS "tenantId", t.plan, t.status AS "tenantStatus"
       FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.email = $1`, [email]
    );
    if (result.rows.length === 0) throw AppError.unauthorized('Credenciais inválidas.', 'INVALID_CREDENTIALS');
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw AppError.unauthorized('Credenciais inválidas.', 'INVALID_CREDENTIALS');
    if (user.tenantStatus === 'suspended') throw AppError.forbidden('Conta suspensa.', 'ACCOUNT_SUSPENDED');
    const token = generateToken({ id: user.id, email: user.email, role: user.role }, { id: user.tenantId, plan: user.plan });
    res.json(success({ token }, 'Login realizado com sucesso'));
  } catch (err) { next(err); }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    if (Date.now() - decoded.exp * 1000 > 7 * 24 * 60 * 60 * 1000) throw AppError.unauthorized('Token expirado.', 'REFRESH_EXPIRED');
    const result = await query(`SELECT u.id, u.email, u.role, t.id AS "tenantId", t.plan FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = $1`, [decoded.sub]);
    if (!result.rows.length) throw AppError.unauthorized('Usuário não encontrado.');
    const user = result.rows[0];
    const newToken = generateToken({ id: user.id, email: user.email, role: user.role }, { id: user.tenantId, plan: user.plan });
    res.json(success({ token: newToken }));
  } catch (err) { next(err); }
};

exports.getMe = async (req, res, next) => {
  try { res.json(success({ tenant: req.tenant, user: req.user })); } catch (err) { next(err); }
};

exports.updateMe = async (req, res, next) => {
  try {
    const data = z.object({ name: z.string().min(2).max(150).optional(), segment: z.string().optional() }).parse(req.body);
    await query(`UPDATE tenants SET name = COALESCE($1, name), segment = COALESCE($2, segment) WHERE id = $3`, [data.name, data.segment, req.tenant.id]);
    res.json(success(null, 'Dados atualizados com sucesso'));
  } catch (err) { next(err); }
};

exports.listBots = async (req, res, next) => {
  try {
    const result = await query('SELECT id, name, tone, active, created_at FROM bots WHERE tenant_id = $1 ORDER BY created_at DESC', [req.tenant.id]);
    res.json(success({ bots: result.rows }));
  } catch (err) { next(err); }
};

exports.createBot = async (req, res, next) => {
  try {
    const data = botSchema.parse(req.body);
    const tenant = req.tenant;
    const countResult = await query('SELECT COUNT(*) AS count FROM bots WHERE tenant_id = $1', [tenant.id]);
    const botCount = parseInt(countResult.rows[0].count);
    if (tenant.botLimit !== null && botCount >= tenant.botLimit) {
      throw AppError.planLimitReached(`Seu plano permite no máximo ${tenant.botLimit} bot(s).`);
    }
    const botId = uuidv4();
    await query(`INSERT INTO bots (id, tenant_id, name, system_prompt, welcome_message, tone, active) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [botId, tenant.id, data.name, data.systemPrompt, data.welcomeMessage, data.tone, data.active]);
    res.status(201).json(success({ id: botId, ...data }, 'Bot criado com sucesso'));
  } catch (err) { next(err); }
};

exports.getBot = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM bots WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenant.id]);
    if (!result.rows.length) throw AppError.notFound('Bot não encontrado.');
    res.json(success({ bot: result.rows[0] }));
  } catch (err) { next(err); }
};

exports.updateBot = async (req, res, next) => {
  try {
    const data = botSchema.partial().parse(req.body);
    await query(
      `UPDATE bots SET name = COALESCE($1, name), system_prompt = COALESCE($2, system_prompt),
       welcome_message = COALESCE($3, welcome_message), tone = COALESCE($4, tone),
       active = COALESCE($5, active), updated_at = NOW() WHERE id = $6 AND tenant_id = $7`,
      [data.name, data.systemPrompt, data.welcomeMessage, data.tone, data.active, req.params.id, req.tenant.id]
    );
    res.json(success(null, 'Bot atualizado com sucesso'));
  } catch (err) { next(err); }
};

exports.deleteBot = async (req, res, next) => {
  try {
    const result = await query('DELETE FROM bots WHERE id = $1 AND tenant_id = $2 RETURNING id', [req.params.id, req.tenant.id]);
    if (!result.rows.length) throw AppError.notFound('Bot não encontrado.');
    res.json(success(null, 'Bot removido com sucesso'));
  } catch (err) { next(err); }
};

exports.listUsers = async (req, res, next) => {
  try {
    const result = await query('SELECT id, name, email, role, created_at FROM users WHERE tenant_id = $1', [req.tenant.id]);
    res.json(success({ users: result.rows }));
  } catch (err) { next(err); }
};

exports.inviteUser = async (req, res, next) => { res.json(success(null, 'Convite enviado (a implementar)')); };

exports.removeUser = async (req, res, next) => {
  try {
    await query('DELETE FROM users WHERE id = $1 AND tenant_id = $2 AND role != $3', [req.params.userId, req.tenant.id, 'owner']);
    res.json(success(null, 'Usuário removido'));
  } catch (err) { next(err); }
};

exports.health = async (req, res, next) => {
  try {
    const { testConnection: dbTest } = require('../../models/db');
    const [dbOk, redisOk] = await Promise.allSettled([dbTest(), redisTest()]);
    res.json(success({ status: 'ok', service: 'tenant', database: dbOk.status === 'fulfilled' ? 'connected' : 'error', redis: redisOk.status === 'fulfilled' ? 'connected' : 'error' }));
  } catch (err) { next(err); }
};
