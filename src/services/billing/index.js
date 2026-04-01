const router = require("express").Router();
const { auth } = require("../../gateway/middlewares/auth");
const { tenantLimiter } = require("../../gateway/middlewares/rateLimiter");
const { injectTenant } = require("../../gateway/middlewares/injectTenant");
const billingController = require("./billingController");

router.post("/webhook/asaas", billingController.webhook);

router.use(auth, injectTenant, tenantLimiter);

router.get("/plans", billingController.listPlans);
router.get("/subscription", billingController.getSubscription);
router.post("/subscribe", billingController.subscribe);
router.post("/cancel", billingController.cancelSubscription);
router.get("/invoices", billingController.listInvoices);
router.get("/usage", billingController.getUsage);
router.get("/health", billingController.health);

module.exports = router;
