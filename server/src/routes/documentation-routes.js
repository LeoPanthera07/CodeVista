'use strict';

const { Router } = require('express');
const asyncHandler = require('../middleware/async-handler');
const { validateRepoId, validateDocType } = require('../middleware/validators');
const docService = require('../services/documentation-service');

const router = Router({ mergeParams: true });

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/repositories/:id/documentation — Generate documentation
// ═════════════════════════════════════════════════════════════════════════════
router.post(
  '/',
  validateRepoId,
  validateDocType,
  asyncHandler(async (req, res) => {
    const doc = await docService.generateDocumentation(req.params.id, req.body.type);
    res.status(201).json({ success: true, data: doc });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/repositories/:id/documentation — List generated docs
// ═════════════════════════════════════════════════════════════════════════════
router.get(
  '/',
  validateRepoId,
  asyncHandler(async (req, res) => {
    const docs = docService.getDocumentation(req.params.id);
    res.json({ success: true, data: docs });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/repositories/:id/documentation/:docId — Get single doc
// ═════════════════════════════════════════════════════════════════════════════
router.get(
  '/:docId',
  validateRepoId,
  asyncHandler(async (req, res) => {
    const doc = docService.getDocumentationById(req.params.id, req.params.docId);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Documentation not found' });
    }
    res.json({ success: true, data: doc });
  }),
);

module.exports = router;
