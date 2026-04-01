const router = require('express').Router();
const { auth, requireRole } = require('../../gateway/middlewares/auth');
const { tenantLimiter, authLimiter } = require('../../gateway/middlewares/rateLimiter');
const { injectTenant } = require('../../gateway/middlewares/injectTenant');
const tenantController = require('./tenantController');

router.post('/register', authLimiter, tenantController.register);
router.post('/login', authLimiter, tenantController.login);
router.post('/refresh-token', tenantController.refreshToken);

router.use(auth, injectTenant, tenantLimiter);

router.get('/me', tenantController.getMe);
router.patch('/me', tenantController.updateMe);
router.get('/bots', tenantController.listBots);
router.post('/bots', tenantController.createBot);
router.get('/bots/:id', tenantController.getBot);
router.patch('/bots/:id', tenantController.updateBot);
router.delete('/bots/:id', requireRole('owner', 'admin'), tenantController.deleteBot);
router.get('/users', requireRole('owner', 'admin'), tenantController.listUsers);
router.post('/users/invite', requireRole('owner'), tenantController.inviteUser);
router.delete('/users/:userId', requireRole('owner'), tenantController.removeUser);
router.get('/health', tenantController.health);

module.exports = router;
