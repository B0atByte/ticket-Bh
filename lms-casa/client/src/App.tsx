import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { AppShell } from './layout/AppShell';
import { LearningShell } from './layout/LearningShell';

const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })));
const AttemptHistoryPage = lazy(() => import('./pages/AttemptHistoryPage').then((m) => ({ default: m.AttemptHistoryPage })));
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage').then((m) => ({ default: m.CourseDetailPage })));
const ExamBuilderDetailPage = lazy(() => import('./pages/ExamBuilderPage').then((m) => ({ default: m.ExamBuilderDetailPage })));
const ExamBuilderListPage = lazy(() => import('./pages/ExamBuilderPage').then((m) => ({ default: m.ExamBuilderListPage })));
const ExamPage = lazy(() => import('./pages/ExamPage').then((m) => ({ default: m.ExamPage })));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })));
const LessonPage = lazy(() => import('./pages/LessonPage').then((m) => ({ default: m.LessonPage })));
const LearningPage = lazy(() => import('./pages/LearningPage').then((m) => ({ default: m.LearningPage })));
const ManagerDashboardPage = lazy(() => import('./pages/ManagerDashboardPage').then((m) => ({ default: m.ManagerDashboardPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const CoursesPage = lazy(() => import('./pages/CoursesPage').then((m) => ({ default: m.CoursesPage })));
const DashboardPage = lazy(() => import('./pages/ShellPages').then((m) => ({ default: m.DashboardPage })));
const QuestionBankPage = lazy(() => import('./pages/QuestionBankPage').then((m) => ({ default: m.QuestionBankPage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const DepartmentsPage = lazy(() => import('./pages/DepartmentsPage').then((m) => ({ default: m.DepartmentsPage })));
const EmployeeRecordPage = lazy(() => import('./pages/EmployeeRecordPage').then((m) => ({ default: m.EmployeeRecordPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const OidcCompletePage = lazy(() => import('./pages/OidcCompletePage').then((m) => ({ default: m.OidcCompletePage })));

function PageFallback() {
  return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/oidc/complete" element={<Suspense fallback={<PageFallback />}><OidcCompletePage /></Suspense>} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Suspense fallback={<PageFallback />}><DashboardPage /></Suspense>} />
          <Route path="/courses" element={<Suspense fallback={<PageFallback />}><CoursesPage /></Suspense>} />
          <Route path="/courses/:courseId" element={<Suspense fallback={<PageFallback />}><CourseDetailPage /></Suspense>} />
          <Route path="/lessons/:lessonId" element={<Suspense fallback={<PageFallback />}><LessonPage /></Suspense>} />
          <Route path="/exams" element={<Suspense fallback={<PageFallback />}><CoursesPage /></Suspense>} />
          <Route path="/exams/:examId" element={<Suspense fallback={<PageFallback />}><ExamPage /></Suspense>} />
          <Route path="/attempts" element={<Suspense fallback={<PageFallback />}><AttemptHistoryPage /></Suspense>} />
          <Route path="/leaderboard" element={<Suspense fallback={<PageFallback />}><LeaderboardPage /></Suspense>} />
          <Route path="/team" element={<Suspense fallback={<PageFallback />}><ManagerDashboardPage /></Suspense>} />
          <Route path="/admin" element={<Suspense fallback={<PageFallback />}><AdminDashboardPage /></Suspense>} />
          <Route path="/admin/audit" element={<Suspense fallback={<PageFallback />}><AuditLogsPage /></Suspense>} />
          <Route path="/admin/settings" element={<Suspense fallback={<PageFallback />}><SettingsPage /></Suspense>} />
          <Route path="/admin/questions" element={<Suspense fallback={<PageFallback />}><QuestionBankPage /></Suspense>} />
          <Route path="/admin/exams" element={<Suspense fallback={<PageFallback />}><ExamBuilderListPage /></Suspense>} />
          <Route path="/admin/exams/:examId" element={<Suspense fallback={<PageFallback />}><ExamBuilderDetailPage /></Suspense>} />
          <Route path="/users" element={<Suspense fallback={<PageFallback />}><UsersPage /></Suspense>} />
          <Route path="/users/:id/record" element={<Suspense fallback={<PageFallback />}><EmployeeRecordPage /></Suspense>} />
          <Route path="/admin/departments" element={<Suspense fallback={<PageFallback />}><DepartmentsPage /></Suspense>} />
          <Route path="/me/record" element={<Suspense fallback={<PageFallback />}><EmployeeRecordPage self /></Suspense>} />
          <Route path="/me/privacy" element={<Suspense fallback={<PageFallback />}><PrivacyPage /></Suspense>} />
        </Route>
        {/* Learning experience — full viewport, no AppShell sidebar */}
        <Route element={<LearningShell />}>
          <Route path="/courses/:courseId/learn" element={<Suspense fallback={<PageFallback />}><LearningPage /></Suspense>} />
          <Route path="/courses/:courseId/learn/:lessonId" element={<Suspense fallback={<PageFallback />}><LearningPage /></Suspense>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
