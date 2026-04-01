const router = require('express').Router();
const Stripe = require('stripe');
const logger = require('../utils/logger');
const { query } = require('../models/db');
const { invalidateTenantCache } = require('../gateway/middlewares/injectTenant');
const { processIncomingMessage } = require('../services/chat/whatsappService');

router.post('/stripe', require('express').raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn('Stripe webhook: assinatura inválida', { error: err.message });
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  logger.info('Stripe webhook recebido', { type: event.type });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { tenantId, planId } = session.metadata;
        await query(`UPDATE tenants SET plan = $1, status = 'active', subscription_id = $2, next_billing_at = NOW() + INTERVAL '1 month' WHERE id = $3`, [planId, session.subscription, tenantId]);
        await invalidateTenantCache(tenantId);
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object;
        const customer = await new Stripe(process.env.STRIPE_SECRET_KEY).customers.retrieve(invoice.customer);
        const tenantId = customer.metadata?.tenantId;
        if (tenantId) {
          await query(`UPDATE tenants SET message_count_this_month = 0, next_billing_at = NOW() + INTERVAL '1 month' WHERE id = $1`, [tenantId]);
          await invalidateTenantCache(tenantId);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const result = await query('UPDATE tenants SET plan = $1, status = $2 WHERE subscription_id = $3 RETURNING id', ['starter', 'inactive', sub.id]);
        if (result.rows.length) await invalidateTenantCache(result.rows[0].id);
        break;
      }
      default:
        logger.debug('Stripe webhook event ignorado', { type: event.type });
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Erro ao processar Stripe webhook', { error: err.message, type: event.type });
    res.json({ received: true, warning: 'Processamento falhou internamente' });
  }
});

router.get('/whatsapp', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verificado');
    return res.status(200).send(challenge);
  }
  res.status(403).json({ error: 'Verificação falhou' });
});

router.post('/whatsapp', async (req, res) => {
  res.status(200).json({ ok: true });
  try {
    const payload = req.body;
    if (payload.event !== 'messages.upsert') return;
    const remoteJid = payload.data?.key?.remoteJid || '';
    if (payload.data?.key?.fromMe || remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) return;
    await processIncomingMessage(payload);
  } catch (err) {
    logger.error('Erro no processamento do webhook WhatsApp', { error: err.message, instance: req.body?.instance });
  }
});

module.exports = router;
