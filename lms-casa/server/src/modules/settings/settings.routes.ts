import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HttpError } from '../../utils/httpError.js';
import { extForMime } from '../../utils/uploadExt.js';
import * as controller from './settings.controller.js';

const uploadDir = path.resolve(process.cwd(), 'uploads', 'branding');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    // Extension from the validated mime, never the attacker-controlled originalname.
    const ext = extForMime(file.mimetype);
    cb(null, `logo-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
      cb(HttpError.badRequest('Logo must be PNG, JPG, or WEBP'));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.use(requireAuth);
router.get('/branding', requirePermission('settings.read'), asyncHandler(controller.getBranding));
router.put('/branding', requirePermission('settings.update'), asyncHandler(controller.updateBranding));
// Anti-AFK config: readable by any authenticated user (the video player needs it),
// editable by admins only.
router.get('/anti-afk', asyncHandler(controller.getAntiAfk));
router.put('/anti-afk', requirePermission('settings.update'), asyncHandler(controller.updateAntiAfk));
router.post(
  '/branding/logo',
  requirePermission('settings.update'),
  upload.single('logo'),
  asyncHandler(controller.uploadLogo),
);

export default router;
