import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import * as controller from './courses.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { HttpError } from '../../utils/httpError.js';
import { extForMime } from '../../utils/uploadExt.js';

const coverDir = path.resolve(process.cwd(), 'uploads', 'courses');
fs.mkdirSync(coverDir, { recursive: true });
const coverUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, coverDir),
    filename: (_req, file, cb) => {
      // Extension from the validated mime, never the attacker-controlled originalname.
      const ext = extForMime(file.mimetype);
      cb(null, `cover-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
      cb(HttpError.badRequest('Cover must be PNG, JPG, or WEBP'));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /courses:
 *   get:
 *     tags: [Courses]
 *     summary: List courses
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Courses]
 *     summary: Create course
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Created }
 */
router.get('/', requirePermission('course.read'), asyncHandler(controller.list));
// Cover image upload (used by create/edit form before the course exists) — returns { url }
router.post(
  '/cover',
  requirePermission('course.create'),
  coverUpload.single('image'),
  asyncHandler(controller.uploadCover),
);
router.get('/:id', requirePermission('course.read'), asyncHandler(controller.get));
router.post('/', requirePermission('course.create'), asyncHandler(controller.create));
router.patch('/:id', requirePermission('course.update'), asyncHandler(controller.update));
router.post('/:id/publish', requirePermission('course.publish'), asyncHandler(controller.publish));
router.post('/:id/archive', requirePermission('course.publish'), asyncHandler(controller.archive));
router.delete('/:id', requirePermission('course.delete'), asyncHandler(controller.remove));

export default router;
