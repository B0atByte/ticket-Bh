import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './lesson-progress.controller.js';

// Nested under /lessons/:lessonId/progress
const router = Router({ mergeParams: true });
router.use(requireAuth);
router.get('/', requirePermission('lesson.read'), asyncHandler(controller.get));
router.put('/', requirePermission('lesson.read'), asyncHandler(controller.upsert));
// Anti-AFK kick: reset progress to the start (does not affect exam eligibility)
router.post('/afk-fail', requirePermission('lesson.read'), asyncHandler(controller.afkFail));
// Log a blocked forward-seek (anti-skip) for HR visibility
router.post('/seek-blocked', requirePermission('lesson.read'), asyncHandler(controller.seekBlocked));

// Nested under /courses/:courseId/lesson-progress — all of the user's progress for a course
const courseRouter = Router({ mergeParams: true });
courseRouter.use(requireAuth);
courseRouter.get('/', requirePermission('lesson.read'), asyncHandler(controller.listByCourse));

export { courseRouter as courseLessonProgressRouter };
export default router;
