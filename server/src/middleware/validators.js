'use strict';

/**
 * Input validation middleware factories.
 * Each returns an Express middleware that validates req.body / req.params / req.query
 * and calls next() or responds with 400.
 */

/**
 * Validate that the request body contains a non-empty `url` string.
 */
function validateGitUrl(req, res, next) {
  const { url } = req.body;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ success: false, error: 'A valid Git URL is required in the request body (field: url)' });
  }

  // Basic URL format check
  const trimmed = url.trim();
  if (!/^https?:\/\/.+/i.test(trimmed) && !/^git@.+:.+/i.test(trimmed)) {
    return res.status(400).json({ success: false, error: 'URL must be a valid HTTP(S) or SSH Git URL' });
  }

  req.body.url = trimmed;
  next();
}

/**
 * Validate that req.params.id is a non-empty string (UUID format check is optional).
 */
function validateRepoId(req, res, next) {
  const { id } = req.params;
  if (!id || typeof id !== 'string' || !id.trim()) {
    return res.status(400).json({ success: false, error: 'Repository ID is required' });
  }
  next();
}

/**
 * Validate that req.params.fileId is a non-empty string.
 */
function validateFileId(req, res, next) {
  const { fileId } = req.params;
  if (!fileId || typeof fileId !== 'string' || !fileId.trim()) {
    return res.status(400).json({ success: false, error: 'File ID is required' });
  }
  next();
}

/**
 * Validate that the request body contains a non-empty `message` string.
 */
function validateChatMessage(req, res, next) {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, error: 'A non-empty message is required' });
  }
  req.body.message = message.trim();
  next();
}

/**
 * Validate documentation generation request.
 */
function validateDocType(req, res, next) {
  const { type } = req.body;
  const validTypes = ['readme', 'onboarding', 'architecture', 'module'];
  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      error: `Documentation type is required and must be one of: ${validTypes.join(', ')}`,
    });
  }
  next();
}

/**
 * Validate that a file was uploaded (for multer).
 */
function validateFileUpload(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'A ZIP archive file is required' });
  }

  const ext = req.file.originalname.split('.').pop().toLowerCase();
  if (ext !== 'zip') {
    return res.status(400).json({ success: false, error: 'Only ZIP archives are supported' });
  }

  next();
}

module.exports = {
  validateGitUrl,
  validateRepoId,
  validateFileId,
  validateChatMessage,
  validateDocType,
  validateFileUpload,
};
