import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './lesson-notes.controller.js';

// Nested under /lessons/:lessonId/notes
const router = Router({ mergeParams: true });
router.use(requireAuth);
router.get('/', requirePermission('lesson.read'), asyncHandler(controller.list));
router.post('/', requirePermission('lesson.read'), asyncHandler(controller.create));
router.patch('/:noteId', requirePermission('lesson.read'), asyncHandler(controller.update));
router.delete('/:noteId', requirePermission('lesson.read'), asyncHandler(controller.remove));

export default router;
