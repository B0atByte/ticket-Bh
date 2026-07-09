import { Outlet } from 'react-router-dom';

// Auth is handled by ProtectedRoute (parent route)
export function LearningShell() {
  return <Outlet />;
}
