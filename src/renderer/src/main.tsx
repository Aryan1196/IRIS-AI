import './assets/main.css'

import React, { JSX, StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'

import MainRoute from './MainRoute'
import LockScreen from './UI/LockScreen'
import LoginPage from './auth/Login'
import SetupPage from './auth/Setup'
import { useAuthStore } from './store/auth-store'
import AxiosInstance from './config/AxiosInstance'

const electronAPI = (window as any).electron?.ipcRenderer

// --- 1. ERROR BOUNDARY ---
class SystemErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorMsg: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center text-red-500 font-mono p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">CRITICAL SYSTEM FAILURE</h1>
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300 max-w-2xl break-words">
            {this.state.errorMsg}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// --- 2. THE SECURITY GATEKEEPER ---
// We keep track of session unlock state in memory so it resets when the app is closed
let isSessionUnlocked = false

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const [status, setStatus] = useState<'checking' | 'authorized'>('checking')
  const navigate = useNavigate()
  const location = useLocation()

  // Zustand store actions
  const accessToken = useAuthStore((state) => state.accessToken)
  const logout = useAuthStore((state) => state.logout)

  useEffect(() => {
    const verifyAccess = async () => {
      try {
        // 1. Check if they have a token locally
        if (!accessToken && !localStorage.getItem('iris_cloud_token')) {
          navigate('/login', { replace: true })
          return
        }

        // 2. Ping your backend to ensure the token isn't dead/banned
        const userRes = await AxiosInstance.get('/users/me')
        if (userRes.status !== 200) throw new Error('Cloud Auth Failed')

        // 3. Check if local hardware API keys exist in safeStorage
        if (electronAPI) {
          const keysExist = await electronAPI.invoke('check-keys-exist')
          if (!keysExist) {
            navigate('/setup', { replace: true })
            return
          }
        }

        // 4. Check if they have passed the Biometric/PIN LockScreen for this session
        if (!isSessionUnlocked && location.pathname !== '/lock') {
          navigate('/lock', { replace: true })
          return
        }

        // If all checks pass, render the protected component
        setStatus('authorized')
      } catch (error) {
        console.error('Security Check Failed:', error)
        logout() // Clear zustand/localStorage
        navigate('/login', { replace: true })
      }
    }

    verifyAccess()
  }, [navigate, location.pathname, accessToken, logout])

  if (status === 'checking') {
    return (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center text-[#10b981] font-mono text-sm tracking-widest uppercase">
        Verifying Security Clearance...
      </div>
    )
  }

  return children
}

// --- 3. PUBLIC ROUTE GUARD (Redirects logged-in users away from /login) ---
const PublicRoute = ({ children }: { children: JSX.Element }) => {
  const accessToken =
    useAuthStore((state) => state.accessToken) || localStorage.getItem('iris_cloud_token')
  return accessToken ? <Navigate to="/" replace /> : children
}

// --- 4. THE ROUTER APP ---
const AppRouter = () => {
  const navigate = useNavigate()

  useEffect(() => {
    // Deep Link Listener for Google OAuth
    if (electronAPI) {
      electronAPI.on('oauth-callback', (_event: any, url: string) => {
        try {
          const urlObj = new URL(url)
          const token = urlObj.searchParams.get('token')
          if (token) {
            useAuthStore.getState().setAccessToken(token)
            localStorage.setItem('iris_cloud_token', token)
            navigate('/') // Send them to the gatekeeper to get sorted
          }
        } catch (e) {
          console.error('Failed to parse OAuth URL', e)
        }
      })
    }
    return () => electronAPI?.removeAllListeners('oauth-callback')
  }, [navigate])

  return (
    <Routes>
      {/* PUBLIC ROUTES */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage onLoginSuccess={() => navigate('/setup')} />
          </PublicRoute>
        }
      />

      {/* SETUP API KEYS */}
      <Route path="/setup" element={<SetupPage onSetupComplete={() => navigate('/lock')} />} />

      {/* LOCK SCREEN */}
      <Route
        path="/lock"
        element={
          <ProtectedRoute>
            <LockScreen
              onUnlock={() => {
                isSessionUnlocked = true
                navigate('/') // Go to the main app!
              }}
            />
          </ProtectedRoute>
        }
      />

      {/* THE MAIN APP (Dashboard, AI, Widgets) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainRoute />
          </ProtectedRoute>
        }
      />

      {/* CATCH-ALL (404) */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// --- 5. ROOT RENDER ---
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemErrorBoundary>
      {/* HashRouter wraps everything for Electron compatibility */}
      <HashRouter>
        <AppRouter />
      </HashRouter>
    </SystemErrorBoundary>
  </StrictMode>
)
