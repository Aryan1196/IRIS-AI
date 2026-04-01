import './assets/main.css'

import React, { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'

// ⚠️ IMPORTANT: Verify these 4 paths exactly match your folder structure!
import App from './App'
import LockScreen from './UI/LockScreen'
import LoginPage from './auth/Login'
import SetupPage from './auth/Setup'

// Electron IPC Bridge Check
const electronAPI = (window as any).electron?.ipcRenderer

// --- SIMPLE ERROR BOUNDARY ---
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
          <p className="text-sm text-red-400 mb-2">
            React Render Tree Crashed. Check DevTools (Ctrl+Shift+I).
          </p>
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300 max-w-2xl break-words">
            {this.state.errorMsg}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const RootApp = () => {
  const [authState, setAuthState] = useState<'loading' | 'login' | 'setup' | 'locked' | 'app'>(
    'loading'
  )

  useEffect(() => {
    const checkSystemState = async () => {
      try {
        // 1. Check Cloud Auth (JWT)
        const jwt = localStorage.getItem('iris_cloud_token')
        if (!jwt) {
          setAuthState('login')
          return
        }

        // 2. Check Secure Local Keys via Electron IPC
        if (electronAPI) {
          const keysExist = await electronAPI.invoke('check-keys-exist')
          if (!keysExist) {
            setAuthState('setup')
            return
          }
        } else {
          console.warn('Electron IPC not detected. Running in pure web mode.')
        }

        // 3. Default to Locked state for biometric/PIN entry
        setAuthState('locked')
      } catch (error) {
        console.error('System Check Failed:', error)
        setAuthState('login') // Fallback to login if something breaks
      }
    }

    checkSystemState()

    // Listen for Google OAuth deep link callbacks
    if (electronAPI) {
      electronAPI.on('oauth-callback', (_event: any, url: string) => {
        try {
          const urlObj = new URL(url)
          const token = urlObj.searchParams.get('token')
          if (token) {
            localStorage.setItem('iris_cloud_token', token)
            checkSystemState() // Re-evaluate state
          }
        } catch (e) {
          console.error('Failed to parse OAuth URL', e)
        }
      })
    }
  }, [])

  // Show this while checking tokens
  if (authState === 'loading') {
    return (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center text-[#10b981] font-mono text-sm tracking-widest uppercase">
        Initializing Core Systems...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#050505] overflow-hidden relative border border-[#10b981]/20 rounded-xl">
      <div className="flex-1 relative overflow-hidden">
        {/* Pass the state control down to the components */}
        {authState === 'login' && <LoginPage onLoginSuccess={() => setAuthState('setup')} />}
        {authState === 'setup' && <SetupPage onSetupComplete={() => setAuthState('locked')} />}
        {authState === 'locked' && <LockScreen onUnlock={() => setAuthState('app')} />}
        {authState === 'app' && <App />}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemErrorBoundary>
      <RootApp />
    </SystemErrorBoundary>
  </StrictMode>
)
