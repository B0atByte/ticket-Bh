import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { LoginPage } from './pages/LoginPage'
import { KitchenPage } from './pages/KitchenPage'
import { AdminPage } from './pages/AdminPage'
import { DriverPage } from './pages/DriverPage'
import { BranchPage } from './pages/BranchPage'
import { Loader2 } from 'lucide-react'

function AppContent() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 size={28} className="text-blue-600 animate-spin" />
      </div>
    )
  }

  if (!user) return <LoginPage />

  switch (user.role) {
    case 'KITCHEN': return <KitchenPage />
    case 'ADMIN':   return <AdminPage />
    case 'DRIVER':  return <DriverPage />
    case 'BRANCH':  return <BranchPage />
    default:        return <LoginPage />
  }
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
