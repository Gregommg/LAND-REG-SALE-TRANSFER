const express = require("express");
const router = express.Router();
const { listConversations, getConversation, sendMessage } = require("../controllers/messageController");
const protect = require("../middleware/authMiddleware");

router.get("/", protect, listConversations);
router.get("/:userId", protect, getConversation);
router.post("/", protect, sendMessage);

module.exports = router;
