'use strict';

const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const asyncHandler = require('../middleware/async-handler');
const {
  validateGitUrl,
  validateRepoId,
  validateFileId,
  validateFileUpload,
} = require('../middleware/validators');
const repoService = require('../services/repository-service');
const analysisService = require('../services/analysis-service');

const router = Router();

// ── Multer config for file uploads ──────────────────────────────────────────
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOADS_DIR || 'uploads');
const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.zip') {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP archives are supported'));
    }
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/repositories/connect — Clone a GitHub repo
// ═════════════════════════════════════════════════════════════════════════════
router.post(
  '/connect',
  validateGitUrl,
  asyncHandler(async (req, res) => {
    const repo = await repoService.cloneRepository(req.body.url);

    // Kick off analysis in the background
    analysisService.analyzeRepository(repo.id).catch((err) => {
      console.error(`[BG] Analysis failed for ${repo.id}:`, err.message);
    });

    res.status(201).json({ success: true, data: repo });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/repositories/upload — Upload a source archive
// ═════════════════════════════════════════════════════════════════════════════
router.post(
  '/upload',
  upload.single('file'),
  validateFileUpload,
  asyncHandler(async (req, res) => {
    const repo = repoService.uploadRepository(req.file);

    // Kick off analysis in the background
    analysisService.analyzeRepository(repo.id).catch((err) => {
      console.error(`[BG] Analysis failed for ${repo.id}:`, err.message);
    });

    res.status(201).json({ success: true, data: repo });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/repositories — List all repositories
// ═════════════════════════════════════════════════════════════════════════════
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const repos = repoService.listRepositories();
    res.json({ success: true, data: repos });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/repositories/:id — Get repo details
// ═════════════════════════════════════════════════════════════════════════════
router.get(
  '/:id',
  validateRepoId,
  asyncHandler(async (req, res) => {
    const repo = repoService.getRepository(req.params.id);
    if (!repo) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }
    res.json({ success: true, data: repo });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/repositories/:id/status — Get analysis status
// ═════════════════════════════════════════════════════════════════════════════
router.get(
  '/:id/status',
  validateRepoId,
  asyncHandler(async (req, res) => {
    const status = repoService.getRepositoryStatus(req.params.id);
    if (!status) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }
    res.json({ success: true, data: status });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/repositories/:id — Delete a repository
// ═════════════════════════════════════════════════════════════════════════════
router.delete(
  '/:id',
  validateRepoId,
  asyncHandler(async (req, res) => {
    const deleted = repoService.deleteRepository(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }
    res.json({ success: true, data: { message: 'Repository deleted' } });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/repositories/:id/summary — Get multi-level summaries
// ═════════════════════════════════════════════════════════════════════════════
router.get(
  '/:id/summary',
  validateRepoId,
  asyncHandler(async (req, res) => {
    const summaries = analysisService.getRepositorySummaries(req.params.id);
    res.json({ success: true, data: summaries });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/repositories/:id/map — Get dependency/structure map
// ═════════════════════════════════════════════════════════════════════════════
router.get(
  '/:id/map',
  validateRepoId,
  asyncHandler(async (req, res) => {
    const map = analysisService.getRepositoryMap(req.params.id);
    res.json({ success: true, data: map });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/repositories/:id/files — Get file tree
// ═════════════════════════════════════════════════════════════════════════════
router.get(
  '/:id/files',
  validateRepoId,
  asyncHandler(async (req, res) => {
    const tree = analysisService.getFileTree(req.params.id);
    res.json({ success: true, data: tree });
  }),
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/repositories/:id/files/:fileId — Get file content and symbols
// ═════════════════════════════════════════════════════════════════════════════
router.get(
  '/:id/files/:fileId',
  validateRepoId,
  validateFileId,
  asyncHandler(async (req, res) => {
    const details = analysisService.getFileDetails(req.params.id, req.params.fileId);
    if (!details) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    res.json({ success: true, data: details });
  }),
);

module.exports = router;
