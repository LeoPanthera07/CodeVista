'use strict';

const { Router } = require('express');
const asyncHandler = require('../middleware/async-handler');
const { validateRepoId, validateChatMessage } = require('../middleware/validators');
const chatService = require('../services/chat-service');

const router = Router({ mergeParams: true }); // mergeParams to access :id from parent

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/repositories/:id/chat — Send a chat message
// ═════════════════════════════════════════════════════════════════════════════
router.post(
  '/',
  validateRepoId,
  validateChatMessage,
  asyncHandler(async (req, res) => {
    const customApiKey = req.headers['x-groq-api-key'] || req.user?.groq_api_key;
    const reply = await chatService.sendMessage(req.params.id, req.body.message, customApiKey);
    res.json({ success: true, data: reply });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/repositories/:id/chat/history — Get chat history
// ═════════════════════════════════════════════════════════════════════════════
router.get(
  '/history',
  validateRepoId,
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 50;
    const history = chatService.getChatHistory(req.params.id, Math.min(limit, 200));
    res.json({ success: true, data: history });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/repositories/:id/chat/history — Clear chat history
// ═════════════════════════════════════════════════════════════════════════════
router.delete(
  '/history',
  validateRepoId,
  asyncHandler(async (req, res) => {
    const result = chatService.clearHistory(req.params.id);
    res.json({ success: true, data: result });
  }),
);

module.exports = router;
