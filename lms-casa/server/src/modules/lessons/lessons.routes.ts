import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import * as controller from './lessons.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { HttpError } from '../../utils/httpError.js';
import { extForMime } from '../../utils/uploadExt.js';

const materialDir = path.resolve(process.cwd(), 'uploads', 'materials');
fs.mkdirSync(materialDir, { recursive: true });
const materialUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, materialDir),
    filename: (_req, file, cb) => {
      // Extension from the validated mime, never the attacker-controlled originalname.
      const ext = extForMime(file.mimetype);
      cb(null, `material-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(HttpError.badRequest('รองรับเฉพาะไฟล์ PDF'));
      return;
    }
    cb(null, true);
  },
});

// Nested under module: /modules/:moduleId/lessons
const nested = Router({ mergeParams: true });
nested.use(requireAuth);
nested.get('/', requirePermission('lesson.read'), asyncHandler(controller.listByModule));
nested.post('/', requirePermission('lesson.create'), asyncHandler(controller.create));
nested.post('/reorder', requirePermission('lesson.update'), asyncHandler(controller.reorder));

// Flat: /lessons/:id  (and content sub-resource)
const flat = Router();
flat.use(requireAuth);
// PDF material upload (used by the content dialog) — returns { url }. Before '/:id'.
flat.post(
  '/materials',
  requirePermission('lesson.update'),
  materialUpload.single('file'),
  asyncHandler(controller.uploadMaterial),
);
flat.get('/:id', requirePermission('lesson.read'), asyncHandler(controller.get));
flat.patch('/:id', requirePermission('lesson.update'), asyncHandler(controller.update));
flat.delete('/:id', requirePermission('lesson.delete'), asyncHandler(controller.remove));
flat.post('/:id/contents', requirePermission('lesson.update'), asyncHandler(controller.addContent));
flat.delete(
  '/:id/contents/:contentId',
  requirePermission('lesson.update'),
  asyncHandler(controller.removeContent),
);

export { nested as lessonNestedRouter, flat as lessonFlatRouter };
