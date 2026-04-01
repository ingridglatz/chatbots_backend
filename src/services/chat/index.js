const router = require('express').Router();
const { auth } = require('../../gateway/middlewares/auth');
const { tenantLimiter } = require('../../gateway/middlewares/rateLimiter');
const { injectTenant } = require('../../gateway/middlewares/injectTenant');
const chatController = require('./chatController');

router.use(auth, injectTenant, tenantLimiter);

router.post('/message', chatController.sendMessage);
router.get('/history/:sessionId', chatController.getHistory);
router.delete('/session/:sessionId', chatController.clearSession);
router.get('/health', chatController.health);

module.exports = router;
