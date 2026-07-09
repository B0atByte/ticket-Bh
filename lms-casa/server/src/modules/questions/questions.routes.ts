import { Router } from 'express';
import multer from 'multer';
import * as controller from './questions.controller.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HttpError } from '../../utils/httpError.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) {
      cb(HttpError.badRequest('Import file must be CSV or XLSX'));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

// Public — template CSV ไม่มีข้อมูล sensitive ดาวน์โหลดได้โดยไม่ต้อง login
router.get('/import/template.csv', controller.downloadTemplate);

router.use(requireAuth);
router.get('/', requirePermission('question.read'), asyncHandler(controller.list));
router.post(
  '/import/preview',
  requirePermission('question.create'),
  upload.single('file'),
  asyncHandler(controller.previewImport),
);
router.post('/import/commit', requirePermission('question.create'), asyncHandler(controller.commitImport));
router.post('/generate-drafts', requirePermission('question.create'), asyncHandler(controller.generateDrafts));
router.post('/generate-from-course', requirePermission('question.create'), asyncHandler(controller.generateFromCourse));
router.post('/parse-text', requirePermission('question.create'), asyncHandler(controller.parseText));
router.get('/:id', requirePermission('question.read'), asyncHandler(controller.get));
router.post('/', requirePermission('question.create'), asyncHandler(controller.create));
router.patch('/:id', requirePermission('question.update'), asyncHandler(controller.update));
router.delete('/:id', requirePermission('question.delete'), asyncHandler(controller.remove));

export default router;
