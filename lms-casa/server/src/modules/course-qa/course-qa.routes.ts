import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './course-qa.controller.js';

// Nested under /courses/:courseId/questions
const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get('/', requirePermission('course.read'), asyncHandler(controller.listQuestions));
router.post('/', requirePermission('course.read'), asyncHandler(controller.createQuestion));
router.get('/:questionId', requirePermission('course.read'), asyncHandler(controller.getQuestion));
router.delete('/:questionId', requirePermission('course.read'), asyncHandler(controller.deleteQuestion));

// Answers nested under question
router.post('/:questionId/answers', requirePermission('course.read'), asyncHandler(controller.createAnswer));
router.patch('/:questionId/answers/:answerId/accept', requirePermission('course.read'), asyncHandler(controller.acceptAnswer));
router.delete('/:questionId/answers/:answerId', requirePermission('course.read'), asyncHandler(controller.deleteAnswer));

export default router;
