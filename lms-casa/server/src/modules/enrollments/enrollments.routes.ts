import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './enrollments.controller.js';

// Nested under /courses/:courseId/enrollments
export const enrollmentsCourseRouter = Router({ mergeParams: true });
enrollmentsCourseRouter.use(requireAuth);

enrollmentsCourseRouter.post('/enroll', asyncHandler(controller.selfEnroll));
enrollmentsCourseRouter.delete('/enroll', asyncHandler(controller.selfUnenroll));
enrollmentsCourseRouter.get('/enroll/me', asyncHandler(controller.getMyEnrollment));
enrollmentsCourseRouter.get(
  '/',
  requirePermission('enrollment.read'),
  asyncHandler(controller.listByCourse),
);
enrollmentsCourseRouter.post(
  '/',
  requirePermission('enrollment.assign'),
  asyncHandler(controller.adminAssign),
);

// Flat /enrollments
export const enrollmentsFlatRouter = Router();
enrollmentsFlatRouter.use(requireAuth);

enrollmentsFlatRouter.get('/mine', asyncHandler(controller.listMine));
// Redeem an unlock code → enrolls the user in the unlocked course (any authenticated user).
enrollmentsFlatRouter.post('/redeem-code', asyncHandler(controller.redeemUnlockCode));
// Admin re-issues a code for a learner (e.g. they lost theirs).
enrollmentsFlatRouter.post(
  '/issue-code',
  requirePermission('enrollment.assign'),
  asyncHandler(controller.issueUnlockCode),
);
enrollmentsFlatRouter.patch(
  '/:id/status',
  requirePermission('enrollment.assign'),
  asyncHandler(controller.updateStatus),
);
enrollmentsFlatRouter.delete(
  '/:id',
  requirePermission('enrollment.withdraw'),
  asyncHandler(controller.adminWithdraw),
);
// Manual star grant — SUPER_ADMIN only (via the dedicated permission).
enrollmentsFlatRouter.post(
  '/:id/grant-star',
  requirePermission('enrollment.grant_star'),
  asyncHandler(controller.grantStar),
);
enrollmentsFlatRouter.delete(
  '/:id/grant-star',
  requirePermission('enrollment.grant_star'),
  asyncHandler(controller.revokeStar),
);
