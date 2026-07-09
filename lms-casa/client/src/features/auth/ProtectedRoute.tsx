import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ReportIssueButton } from '../issues/ReportIssueButton';
import { me } from './auth.api';
import { useAuthStore } from './auth.store';

export function ProtectedRoute() {
  const location = useLocation();
  const setUser = useAuthStore((state) => state.setUser);
  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: me,
    retry: false,
  });

  useEffect(() => {
    if (query.isSuccess) setUser(query.data);
  }, [query.data, query.isSuccess, setUser]);

  useEffect(() => {
    if (query.isError) setUser(null);
  }, [query.isError, setUser]);

  if (query.isError) return <Navigate to="/login" replace state={{ from: location }} />;

  return query.isLoading ? (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  ) : (
    <>
      <Outlet />
      <ReportIssueButton />
    </>
  );
}
