import { useState } from 'react'
import { getToken } from './lib/api'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => Boolean(getToken()))

  if (!loggedIn) {
    return <LoginPage onLoggedIn={() => setLoggedIn(true)} />
  }

  return <DashboardPage onLoggedOut={() => setLoggedIn(false)} />
}
