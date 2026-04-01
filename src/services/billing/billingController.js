const { query } = require("../../models/db");
const { success } = require("../../utils/response");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");

const ASAAS_BASE =
  process.env.ASAAS_BASE_URL || "https://sandbox.asaas.com/api/v3";
const ASAAS_HEADERS = {
  access_token: process.env.ASAAS_API_KEY || "",
  "Content-Type": "application/json",
};

const asaasRequest = async (method, path, body) => {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: ASAAS_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Asaas ${res.status}`);
    err.response = { data };
    throw err;
  }
  return { data };
};

const asaas = {
  get: (path) => asaasRequest("GET", path),
  post: (path, body) => asaasRequest("POST", path, body),
  delete: (path) => asaasRequest("DELETE", path),
};

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 97,
    currency: "BRL",
    botLimit: 1,
    messageLimit: 500,
    whatsappEnabled: true,
    features: [
      "1 chatbot",
      "500 mensagens/mês",
      "Widget para site",
      "WhatsApp",
      "Suporte por e-mail",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 247,
    currency: "BRL",
    botLimit: 3,
    messageLimit: 3000,
    whatsappEnabled: true,
    features: [
      "3 chatbots",
      "3.000 mensagens/mês",
      "Widget + WhatsApp",
      "Modo operador",
      "Suporte prioritário",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 497,
    currency: "BRL",
    botLimit: null,
    messageLimit: null,
    whatsappEnabled: true,
    features: [
      "Bots ilimitados",
      "Mensagens ilimitadas",
      "Chave de IA própria",
      "API access",
      "SLA 99.9%",
      "Suporte 24/7",
    ],
  },
];

const getOrCreateAsaasCustomer = async (tenantId, tenantName, userEmail) => {
  const result = await query(
    "SELECT asaas_customer_id FROM tenants WHERE id = $1",
    [tenantId],
  );
  const existing = result.rows[0]?.asaas_customer_id;
  if (existing) return existing;

  const res = await asaas.post("/customers", {
    name: tenantName,
    email: userEmail,
    externalReference: tenantId,
    notificationDisabled: false,
  });

  const customerId = res.data.id;
  await query("UPDATE tenants SET asaas_customer_id = $1 WHERE id = $2", [
    customerId,
    tenantId,
  ]);
  return customerId;
};

exports.listPlans = async (req, res, next) => {
  try {
    res.json(success({ plans: PLANS, currentPlan: req.tenant.plan }));
  } catch (err) {
    next(err);
  }
};

exports.getSubscription = async (req, res, next) => {
  try {
    const result = await query(
      "SELECT plan, status, trial_ends_at, asaas_subscription_id, next_billing_at FROM tenants WHERE id = $1",
      [req.tenant.id],
    );
    res.json(success({ subscription: result.rows[0] }));
  } catch (err) {
    next(err);
  }
};

exports.subscribe = async (req, res, next) => {
  try {
    const { planId } = req.body;
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) throw AppError.badRequest("Plano inválido.", "INVALID_PLAN");

    const tenantResult = await query(
      "SELECT name, asaas_subscription_id FROM tenants WHERE id = $1",
      [req.tenant.id],
    );
    const tenant = tenantResult.rows[0];

    if (tenant.asaas_subscription_id) {
      await asaas
        .delete(`/subscriptions/${tenant.asaas_subscription_id}`)
        .catch(() => {});
    }

    const customerId = await getOrCreateAsaasCustomer(
      req.tenant.id,
      tenant.name,
      req.user.email,
    );

    const subscriptionRes = await asaas.post("/subscriptions", {
      customer: customerId,
      billingType: "UNDEFINED",
      value: plan.price,
      nextDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      cycle: "MONTHLY",
      description: `Plano ${plan.name} - ChatBots`,
      externalReference: `${req.tenant.id}:${planId}`,
    });

    const subscription = subscriptionRes.data;

    const paymentsRes = await asaas.get(
      `/payments?subscription=${subscription.id}&limit=1`,
    );
    const firstPayment = paymentsRes.data.data?.[0];
    const paymentLink = firstPayment?.invoiceUrl || null;

    await query(
      "UPDATE tenants SET asaas_subscription_id = $1, plan = $2, status = $3 WHERE id = $4",
      [subscription.id, planId, "trial", req.tenant.id],
    );

    logger.info("Assinatura criada", {
      tenantId: req.tenant.id,
      planId,
      subscriptionId: subscription.id,
    });
    res.json(
      success(
        {
          checkoutUrl: paymentLink,
          paymentLink,
          subscriptionId: subscription.id,
        },
        "Assinatura criada com sucesso",
      ),
    );
  } catch (err) {
    if (err.response?.data)
      logger.error("Erro Asaas", { data: err.response.data });
    next(err);
  }
};

exports.cancelSubscription = async (req, res, next) => {
  try {
    const result = await query(
      "SELECT asaas_subscription_id FROM tenants WHERE id = $1",
      [req.tenant.id],
    );
    const subId = result.rows[0]?.asaas_subscription_id;
    if (!subId)
      throw AppError.badRequest("Nenhuma assinatura ativa.", "NO_SUBSCRIPTION");

    await asaas.delete(`/subscriptions/${subId}`);
    await query(
      "UPDATE tenants SET asaas_subscription_id = NULL, status = 'cancelled' WHERE id = $1",
      [req.tenant.id],
    );

    res.json(success(null, "Assinatura cancelada."));
  } catch (err) {
    next(err);
  }
};

exports.listInvoices = async (req, res, next) => {
  try {
    const result = await query(
      "SELECT asaas_customer_id FROM tenants WHERE id = $1",
      [req.tenant.id],
    );
    const customerId = result.rows[0]?.asaas_customer_id;
    if (!customerId) return res.json(success({ invoices: [] }));

    const res2 = await asaas.get(`/payments?customer=${customerId}&limit=12`);
    const invoices = (res2.data.data || []).map((p) => ({
      id: p.id,
      amount: p.value,
      currency: "BRL",
      status: p.status,
      pdfUrl: p.bankSlipUrl || p.invoiceUrl,
      pixCode: p.pixQrCodeUrl || null,
      dueDate: p.dueDate,
      paymentDate: p.paymentDate,
    }));

    res.json(success({ invoices }));
  } catch (err) {
    next(err);
  }
};

exports.getUsage = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT (SELECT COUNT(*) FROM bots WHERE tenant_id = $1) AS "botsUsed",
              messages_this_month AS "messagesUsed"
       FROM tenants WHERE id = $1`,
      [req.tenant.id],
    );
    res.json(
      success({
        botsUsed: parseInt(result.rows[0].botsUsed),
        messagesUsed: parseInt(result.rows[0].messagesUsed),
        botLimit: req.tenant.botLimit,
        messageLimit: req.tenant.messageLimit,
      }),
    );
  } catch (err) {
    next(err);
  }
};

exports.webhook = async (req, res) => {
  try {
    const event = req.body;
    logger.info("Asaas webhook recebido", {
      event: event.event,
      paymentId: event.payment?.id,
    });

    const payment = event.payment;
    if (!payment?.externalReference) {
      res.sendStatus(200);
      return;
    }

    const [tenantId] = payment.externalReference.split(":");

    switch (event.event) {
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED": {
        const planId = payment.externalReference.split(":")[1];
        const nextBilling = new Date(payment.dueDate);
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        await query(
          "UPDATE tenants SET status = 'active', plan = $1, next_billing_at = $2 WHERE id = $3",
          [planId, nextBilling.toISOString(), tenantId],
        );
        logger.info("Tenant ativado via pagamento", { tenantId, planId });
        break;
      }
      case "PAYMENT_OVERDUE":
      case "SUBSCRIPTION_INACTIVATED": {
        await query("UPDATE tenants SET status = 'suspended' WHERE id = $1", [
          tenantId,
        ]);
        logger.warn("Tenant suspenso por inadimplência", { tenantId });
        break;
      }
    }

    res.sendStatus(200);
  } catch (err) {
    logger.error("Erro no webhook Asaas", { error: err.message });
    res.sendStatus(200);
  }
};

exports.health = async (req, res, next) => {
  try {
    res.json(success({ status: "ok", service: "billing", provider: "asaas" }));
  } catch (err) {
    next(err);
  }
};
