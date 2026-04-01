const router = require("express").Router();
const ctrl = require("./conversationController");

router.get("/bots/:botId/conversations", ctrl.listConversations);

router.get("/conversations/:conversationId/messages", ctrl.getMessages);

router.post("/conversations/:conversationId/takeover", ctrl.takeOver);

router.post("/conversations/:conversationId/release", ctrl.releaseToBot);

router.post("/conversations/:conversationId/send", ctrl.sendOperatorMessage);

module.exports = router;
