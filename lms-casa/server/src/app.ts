import './utils/bigintJson.js';
import express, { type Express } from 'express';
import { setupExpressErrorHandler } from '@sentry/node';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { env } from './config/env.js';
import { isSentryEnabled } from './config/sentry.js';
import { mountSwagger } from './config/swagger.js';
import { errorHandler } from './middleware/error.js';
import { notFoundHandler } from './middleware/notFound.js';
import { mutationRateLimit } from './middleware/rateLimit.js';
import { csrfOriginGuard } from './middleware/csrf.js';
import authRouter from './modules/auth/auth.routes.js';
import oidcRouter from './modules/auth/oidc.routes.js';
import statsRouter from './modules/stats/stats.routes.js';
import pointsRouter from './modules/points/points.routes.js';
import reportsRouter from './modules/reports/reports.routes.js';
import auditLogsRouter from './modules/audit-logs/audit-logs.routes.js';
import settingsRouter from './modules/settings/settings.routes.js';
import notificationsRouter from './modules/notifications/notifications.routes.js';
import issuesRouter from './modules/issues/issues.routes.js';
import meRouter from './modules/me/me.routes.js';
import usersRouter from './modules/users/users.routes.js';
import departmentsRouter from './modules/departments/departments.routes.js';
import coursesRouter from './modules/courses/courses.routes.js';
import {
  moduleNestedRouter,
  moduleFlatRouter,
} from './modules/course-modules/course-modules.routes.js';
import {
  lessonNestedRouter,
  lessonFlatRouter,
} from './modules/lessons/lessons.routes.js';
import questionsRouter from './modules/questions/questions.routes.js';
import banksRouter from './modules/questions/banks.routes.js';
import examsRouter from './modules/exams/exams.routes.js';
import {
  attemptsNestedRouter,
  attemptsFlatRouter,
} from './modules/attempts/attempts.routes.js';
import {
  enrollmentsCourseRouter,
  enrollmentsFlatRouter,
} from './modules/enrollments/enrollments.routes.js';
import lessonProgressRouter, {
  courseLessonProgressRouter,
} from './modules/lesson-progress/lesson-progress.routes.js';
import lessonNotesRouter from './modules/lesson-notes/lesson-notes.routes.js';
import courseQaRouter from './modules/course-qa/course-qa.routes.js';
import {
  practicalCriteriaCourseRouter,
  practicalCriteriaFlatRouter,
  practicalEvalMeRouter,
  practicalEvalEnrollmentRouter,
} from './modules/practical-evaluations/practical-evaluations.routes.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // CSP: strict in production, off in dev (Vite HMR + EventSource + dev tools need wider sources).
  // Adjust directives carefully — too strict will block legitimate client requests.
  app.use(
    helmet({
      contentSecurityPolicy:
        env.NODE_ENV === 'production'
          ? {
              directives: {
                defaultSrc: ["'self'"],
                // YouTube IFrame Player API (for embedded-video progress + Anti-AFK)
                scriptSrc: ["'self'", 'https://www.youtube.com'],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'", env.APP_URL],
                objectSrc: ["'none'"],
                frameSrc: [
                  "'self'",
                  'https://www.youtube.com',
                  'https://www.youtube-nocookie.com',
                  'https://player.vimeo.com',
                ],
                frameAncestors: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                upgradeInsecureRequests: [],
              },
            }
          : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  // Lesson materials (PDFs/slides) are embedded in <iframe> by the learning page —
  // drop X-Frame-Options just for that subpath. Other uploads (covers, branding, certificates)
  // are only ever loaded via <img>/<a download>, so they keep helmet's default frame protection.
  app.use('/uploads/materials', (_req, res, next) => {
    res.removeHeader('X-Frame-Options');
    next();
  });
  // All uploads need to be loadable cross-origin via <img>/<iframe> from the client app.
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(path.resolve(process.cwd(), 'uploads'), { dotfiles: 'deny' }),
  );

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      // Dev skip mirrors the auth-specific limiter (Decision #17) so E2E + manual
      // testing don't get blanket-429'd. Production still enforces.
      skip: () => env.NODE_ENV === 'development',
    }),
  );

  // Health
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: env.NODE_ENV, ts: new Date().toISOString() });
  });

  // CSRF: reject cross-origin state-changing requests (cookie auth). Mounted
  // before all /api/v1 routers so every mutation is covered.
  app.use('/api/v1', csrfOriginGuard);
  app.use('/api/v1', mutationRateLimit);

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/auth/oidc', oidcRouter);
  app.use('/api/v1/me', meRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/departments', departmentsRouter);
  app.use('/api/v1/stats', statsRouter);
  app.use('/api/v1/points', pointsRouter);
  app.use('/api/v1/reports', reportsRouter);
  app.use('/api/v1/audit-logs', auditLogsRouter);
  app.use('/api/v1/settings', settingsRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/issues', issuesRouter);
  app.use('/api/v1/courses', coursesRouter);
  app.use('/api/v1/courses/:courseId/enrollments', enrollmentsCourseRouter);
  app.use('/api/v1/enrollments', enrollmentsFlatRouter);
  app.use('/api/v1/courses/:courseId/modules', moduleNestedRouter);
  app.use('/api/v1/modules', moduleFlatRouter);
  app.use('/api/v1/modules/:moduleId/lessons', lessonNestedRouter);
  app.use('/api/v1/lessons', lessonFlatRouter);
  // Phase 3: lesson progress + notes + bookmarks
  app.use('/api/v1/lessons/:lessonId/progress', lessonProgressRouter);
  app.use('/api/v1/courses/:courseId/lesson-progress', courseLessonProgressRouter);
  app.use('/api/v1/lessons/:lessonId/notes', lessonNotesRouter);
  // Phase 3: course Q&A
  app.use('/api/v1/courses/:courseId/questions', courseQaRouter);
  app.use('/api/v1/questions', questionsRouter);
  app.use('/api/v1/question-banks', banksRouter);
  app.use('/api/v1/exams', examsRouter);
  app.use('/api/v1/exams/:examId/attempts', attemptsNestedRouter);
  app.use('/api/v1/attempts', attemptsFlatRouter);
  // Practical evaluation (ภาคปฏิบัติ)
  app.use('/api/v1/courses/:courseId/practical-criteria', practicalCriteriaCourseRouter);
  app.use('/api/v1/practical-criteria', practicalCriteriaFlatRouter);
  app.use('/api/v1/courses/:courseId/practical-evaluation/me', practicalEvalMeRouter);
  app.use('/api/v1/enrollments/:id/practical-evaluation', practicalEvalEnrollmentRouter);

  mountSwagger(app);

  app.use(notFoundHandler);
  if (isSentryEnabled) {
    setupExpressErrorHandler(app);
  }
  app.use(errorHandler);

  return app;
}
