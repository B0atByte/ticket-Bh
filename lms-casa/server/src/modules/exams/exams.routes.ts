import { Router } from 'express';
import * as controller from './exams.controller.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);
router.get('/', requirePermission('exam.read'), asyncHandler(controller.list));
router.get('/:id', requirePermission('exam.read'), asyncHandler(controller.get));
router.post('/', requirePermission('exam.create'), asyncHandler(controller.create));
router.patch('/:id', requirePermission('exam.update'), asyncHandler(controller.update));
router.post('/:id/questions', requirePermission('exam.update'), asyncHandler(controller.assignQuestion));
router.post('/:id/publish', requirePermission('exam.publish'), asyncHandler(controller.publish));
router.post('/:id/archive', requirePermission('exam.publish'), asyncHandler(controller.archive));
router.delete('/:id', requirePermission('exam.delete'), asyncHandler(controller.remove));

export default router;
