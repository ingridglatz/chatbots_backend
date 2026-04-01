const Stripe = require('stripe');
const { query } = require('../../models/db');
const { success } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) throw new AppError('Stripe não configurado.', 503, 'STRIPE_NOT_CONFIGURED');
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
};

const PLANS = [
  { id: 'starter', name: 'Starter', price: 97, currency: 'BRL', botLimit: 1, messageLimit: 500, whatsappEnabled: false, stripePriceId: process.env.STRIPE_PRICE_STARTER, features: ['1 chatbot', '500 mensagens/mês', 'Widget para site', 'Suporte por e-mail'] },
  { id: 'pro', name: 'Pro', price: 247, currency: 'BRL', botLimit: 3, messageLimit: 3000, whatsappEnabled: false, stripePriceId: process.env.STRIPE_PRICE_PRO, features: ['3 chatbots', '3.000 mensagens/mês', 'Widget para site', 'Análises avançadas', 'Suporte prioritário'] },
  { id: 'business', name: 'Business', price: 497, currency: 'BRL', botLimit: null, messageLimit: null, whatsappEnabled: true, stripePriceId: process.env.STRIPE_PRICE_BUSINESS, features: ['Bots ilimitados', 'Mensagens ilimitadas', 'Widget + WhatsApp', 'API access', 'SLA 99.9%', 'Suporte 24/7'] },
];

exports.listPlans = async (req, res, next) => {
  try { res.json(success({ plans: PLANS, currentPlan: req.tenant.plan })); } catch (err) { next(err); }
};

exports.getSubscription = async (req, res, next) => {
  try {
    const result = await query('SELECT plan, status, trial_ends_at, subscription_id, next_billing_at FROM tenants WHERE id = $1', [req.tenant.id]);
    res.json(success({ subscription: result.rows[0] }));
  } catch (err) { next(err); }
};

exports.createSubscription = async (req, res, next) => {
  try {
    const { planId } = req.body;
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) throw AppError.badRequest('Plano inválido.', 'INVALID_PLAN');
    if (!plan.stripePriceId) throw AppError.badRequest('Plano sem price ID configurado.', 'PRICE_NOT_CONFIGURED');

    const stripe = getStripe();
    const tenantResult = await query('SELECT stripe_customer_id, name FROM tenants WHERE id = $1', [req.tenant.id]);
    const tenant = tenantResult.rows[0];
    let customerId = tenant.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({ name: tenant.name, email: req.user.email, metadata: { tenantId: req.tenant.id } });
      customerId = customer.id;
      await query('UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2', [customerId, req.tenant.id]);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId, mode: 'subscription', payment_method_types: ['card'],
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${process.env.ALLOWED_ORIGINS?.split(',')[0]}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.ALLOWED_ORIGINS?.split(',')[0]}/billing/cancel`,
      metadata: { tenantId: req.tenant.id, planId },
    });

    res.json(success({ checkoutUrl: session.url, sessionId: session.id }));
  } catch (err) { next(err); }
};

exports.cancelSubscription = async (req, res, next) => {
  try {
    const result = await query('SELECT subscription_id FROM tenants WHERE id = $1', [req.tenant.id]);
    const { subscription_id } = result.rows[0];
    if (!subscription_id) throw AppError.badRequest('Nenhuma assinatura ativa encontrada.', 'NO_SUBSCRIPTION');
    const stripe = getStripe();
    await stripe.subscriptions.update(subscription_id, { cancel_at_period_end: true });
    res.json(success(null, 'Assinatura cancelada. Você mantém acesso até o fim do período atual.'));
  } catch (err) { next(err); }
};

exports.listInvoices = async (req, res, next) => {
  try {
    const result = await query('SELECT stripe_customer_id FROM tenants WHERE id = $1', [req.tenant.id]);
    const { stripe_customer_id } = result.rows[0];
    if (!stripe_customer_id) return res.json(success({ invoices: [] }));
    const stripe = getStripe();
    const invoices = await stripe.invoices.list({ customer: stripe_customer_id, limit: 12 });
    const simplified = invoices.data.map((inv) => ({ id: inv.id, amount: inv.amount_paid / 100, currency: inv.currency.toUpperCase(), status: inv.status, pdfUrl: inv.invoice_pdf, date: new Date(inv.created * 1000).toISOString() }));
    res.json(success({ invoices: simplified }));
  } catch (err) { next(err); }
};

exports.getUsage = async (req, res, next) => {
  try {
    const result = await query(`SELECT (SELECT COUNT(*) FROM bots WHERE tenant_id = $1) AS "botsUsed", message_count_this_month AS "messagesUsed" FROM tenants WHERE id = $1`, [req.tenant.id]);
    res.json(success({ botsUsed: parseInt(result.rows[0].botsUsed), messagesUsed: parseInt(result.rows[0].messagesUsed), botLimit: req.tenant.botLimit, messageLimit: req.tenant.messageLimit }));
  } catch (err) { next(err); }
};

exports.health = async (req, res, next) => {
  try { res.json(success({ status: 'ok', service: 'billing' })); } catch (err) { next(err); }
};
