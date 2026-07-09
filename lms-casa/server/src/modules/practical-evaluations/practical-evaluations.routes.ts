import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './practical-evaluations.controller.js';

// Nested under /courses/:courseId/practical-criteria — admin manages the checklist.
export const practicalCriteriaCourseRouter = Router({ mergeParams: true });
practicalCriteriaCourseRouter.use(requireAuth);
practicalCriteriaCourseRouter.get(
  '/',
  requirePermission('practical_eval.manage'),
  asyncHandler(controller.listCriteria),
);
practicalCriteriaCourseRouter.post(
  '/',
  requirePermission('practical_eval.manage'),
  asyncHandler(controller.createCriterion),
);
practicalCriteriaCourseRouter.post(
  '/reorder',
  requirePermission('practical_eval.manage'),
  asyncHandler(controller.reorderCriteria),
);

// Flat /practical-criteria/:id
export const practicalCriteriaFlatRouter = Router();
practicalCriteriaFlatRouter.use(requireAuth);
practicalCriteriaFlatRouter.patch(
  '/:id',
  requirePermission('practical_eval.manage'),
  asyncHandler(controller.updateCriterion),
);
practicalCriteriaFlatRouter.delete(
  '/:id',
  requirePermission('practical_eval.manage'),
  asyncHandler(controller.deleteCriterion),
);

// Nested under /courses/:courseId/practical-evaluation/me — learner's own read-only view.
export const practicalEvalMeRouter = Router({ mergeParams: true });
practicalEvalMeRouter.use(requireAuth);
practicalEvalMeRouter.get('/', asyncHandler(controller.getMyEvaluation));

// Nested under /enrollments/:id/practical-evaluation — instructor/admin grading.
export const practicalEvalEnrollmentRouter = Router({ mergeParams: true });
practicalEvalEnrollmentRouter.use(requireAuth);
practicalEvalEnrollmentRouter.get(
  '/',
  requirePermission('practical_eval.grade'),
  asyncHandler(controller.getEvaluation),
);
practicalEvalEnrollmentRouter.put(
  '/',
  requirePermission('practical_eval.grade'),
  asyncHandler(controller.submitEvaluation),
);
