import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios'
import { useAuthStore } from '@/store/authStore'

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string
const DEV = import.meta.env.DEV

// ─── Dev logger ───────────────────────────────────────────────────────────────
function logRequest(config: InternalAxiosRequestConfig) {
  if (!DEV) return
  const token = (config.headers?.Authorization as string | undefined)?.slice(-8)
  console.groupCollapsed(
    `%c⬆ ${config.method?.toUpperCase()} ${config.url}`,
    'color: #6c3de8; font-weight: bold'
  )
  if (token) console.log('token (last 8):', token)
  if (config.data) console.log('body:', config.data)
  console.groupEnd()
}

function logResponse(response: AxiosResponse): AxiosResponse {
  if (DEV) {
    const { status, config, data } = response
    console.groupCollapsed(
      `%c⬇ ${status} ${config.method?.toUpperCase()} ${config.url}`,
      'color: #1a6b3c; font-weight: bold'
    )
    console.log('data:', data)
    console.groupEnd()
  }
  return response
}

function logError(error: unknown) {
  if (!DEV) return
  const err = error as { config?: InternalAxiosRequestConfig; response?: AxiosResponse; message?: string }
  console.groupCollapsed(
    `%c✗ ERROR ${err.config?.method?.toUpperCase()} ${err.config?.url}`,
    'color: #e83d3d; font-weight: bold'
  )
  if (err.response) {
    console.log('status:', err.response.status)
    console.log('body:', err.response.data)
  } else {
    console.log('message:', err.message)
  }
  console.groupEnd()
}

// ─── Clients ──────────────────────────────────────────────────────────────────

// Unauthenticated — for /auth/* only
export const publicClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

publicClient.interceptors.request.use((config) => { logRequest(config); return config })
publicClient.interceptors.response.use(logResponse, (err) => { logError(err); return Promise.reject(err) })

// Authenticated — injects JWT, auto-refreshes on 401
export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().tokens?.access
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // When the body is FormData (file uploads), remove the default
  // Content-Type so the browser can set it with the correct multipart
  // boundary. Without this Django returns 415 Unsupported Media Type.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }

  logRequest(config)
  return config
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token!)
    }
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (response) => { logResponse(response); return response },
  async (error) => {
    logError(error)
    const originalRequest = error.config

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return apiClient(originalRequest)
        })
        .catch((err) => Promise.reject(err))
    }

    originalRequest._retry = true
    isRefreshing = true

    const refreshToken = useAuthStore.getState().tokens?.refresh

    if (!refreshToken) {
      useAuthStore.getState().clearAuth()
      return Promise.reject(error)
    }

    try {
      const { data } = await publicClient.post('/auth/token/refresh/', {
        refresh: refreshToken,
      })

      const newAccess: string = data.access
      useAuthStore.getState().setTokens({
        access: newAccess,
        refresh: refreshToken,
      })

      processQueue(null, newAccess)
      originalRequest.headers.Authorization = `Bearer ${newAccess}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      useAuthStore.getState().clearAuth()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)
