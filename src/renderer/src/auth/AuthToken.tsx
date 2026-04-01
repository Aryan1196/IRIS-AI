import { useEffect } from 'react'
import { useAuthStore } from '../store/auth-store'
import AxiosInstance from '../config/AxiosInstance' // Fixed the typo from AxiosInstacne

export default function AuthInitializer() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const setIsAuthInitialized = useAuthStore((s: any) => s.setIsAuthInitialized)

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Grab the refresh token from Electron's localStorage
        const storedRefreshToken = localStorage.getItem('iris_cloud_token')

        // 2. If it doesn't exist, don't even bother pinging the backend.
        // Just fail silently and let the Router Gatekeeper kick them to /login.
        if (!storedRefreshToken) {
          setAccessToken(null)
          return
        }

        // 3. CRITICAL FIX: Send the stored token IN THE BODY of the POST request
        const res = await AxiosInstance.post('/users/refresh-token', {
          refreshToken: storedRefreshToken
        })

        // 4. Save the fresh access token into memory
        const accessToken = res.data.accessToken
        setAccessToken(accessToken)

        // Optional: If your backend issues a new refresh token on rotation, save it
        if (res.data.refreshToken) {
          localStorage.setItem('iris_cloud_token', res.data.refreshToken)
        }
      } catch (err) {
        console.error('Auth Initializer failed to refresh token:', err)
        // If the token is dead/expired, wipe it so the Gatekeeper locks them out
        setAccessToken(null)
        localStorage.removeItem('iris_cloud_token')
      } finally {
        // Tell Zustand we are done checking so the app can render
        if (setIsAuthInitialized) setIsAuthInitialized(true)
      }
    }

    init()
  }, [setAccessToken, setIsAuthInitialized])

  return null
}
