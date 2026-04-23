import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../../features/auth/hooks/useAuth'
import {
  ACTIVITY_PERSIST_THROTTLE_MS,
  ACTIVITY_RESET_THROTTLE_MS,
  getActivityStorageKey,
  getIdleTimeoutMs,
  getInactivityLogoutMessage,
  INACTIVITY_EVENTS,
  parseActivityTimestamp,
} from '../../features/auth/utils/inactivity'

function SessionInactivityMonitor() {
  const { isAuthReady, logout, user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const lastActivityAtRef = useRef(0)
  const lastPersistedActivityAtRef = useRef(0)
  const logoutTimeoutRef = useRef(null)
  const isLoggingOutRef = useRef(false)
  const activityStorageKey = user?.id ? getActivityStorageKey(user) : null

  const clearLogoutTimer = useCallback(() => {
    if (logoutTimeoutRef.current == null) {
      return
    }

    window.clearTimeout(logoutTimeoutRef.current)
    logoutTimeoutRef.current = null
  }, [])

  const readStoredActivityAt = useCallback(() => {
    if (typeof window === 'undefined' || !activityStorageKey) {
      return null
    }

    try {
      return parseActivityTimestamp(
        window.localStorage.getItem(activityStorageKey),
      )
    } catch {
      return null
    }
  }, [activityStorageKey])

  const persistActivityAt = useCallback((timestamp, { force = false } = {}) => {
    if (typeof window === 'undefined' || !activityStorageKey) {
      return
    }

    if (
      !force &&
      timestamp - lastPersistedActivityAtRef.current < ACTIVITY_PERSIST_THROTTLE_MS
    ) {
      return
    }

    try {
      window.localStorage.setItem(activityStorageKey, String(timestamp))
      lastPersistedActivityAtRef.current = timestamp
    } catch {
      // Ignore storage sync errors.
    }
  }, [activityStorageKey])

  const handleInactivityLogout = useCallback(async () => {
    if (!user?.id || isLoggingOutRef.current) {
      return
    }

    isLoggingOutRef.current = true
    clearLogoutTimer()

    await logout({
      message: getInactivityLogoutMessage(user),
      suppressErrors: true,
    })

    navigate('/', { replace: true })
  }, [clearLogoutTimer, logout, navigate, user])

  const scheduleLogout = useCallback((referenceTimestamp = lastActivityAtRef.current) => {
    clearLogoutTimer()

    if (!user?.id) {
      return
    }

    const remainingMs =
      getIdleTimeoutMs(user) - Math.max(0, Date.now() - referenceTimestamp)

    if (remainingMs <= 0) {
      void handleInactivityLogout()
      return
    }

    logoutTimeoutRef.current = window.setTimeout(() => {
      void handleInactivityLogout()
    }, remainingMs)
  }, [clearLogoutTimer, handleInactivityLogout, user])

  const syncStoredActivity = useCallback(() => {
    const storedActivityAt = readStoredActivityAt()

    if (
      storedActivityAt != null &&
      storedActivityAt > lastActivityAtRef.current
    ) {
      lastActivityAtRef.current = storedActivityAt
      lastPersistedActivityAtRef.current = storedActivityAt
      scheduleLogout(storedActivityAt)
    }

    return storedActivityAt
  }, [readStoredActivityAt, scheduleLogout])

  const markActivity = useCallback((timestamp = Date.now(), { force = false } = {}) => {
    if (!user?.id || isLoggingOutRef.current) {
      return
    }

    if (
      !force &&
      timestamp - lastActivityAtRef.current < ACTIVITY_RESET_THROTTLE_MS
    ) {
      return
    }

    lastActivityAtRef.current = timestamp
    persistActivityAt(timestamp, { force })
    scheduleLogout(timestamp)
  }, [persistActivityAt, scheduleLogout, user?.id])

  useEffect(() => {
    if (!isAuthReady || !user?.id || !activityStorageKey) {
      clearLogoutTimer()
      isLoggingOutRef.current = false
      lastActivityAtRef.current = 0
      lastPersistedActivityAtRef.current = 0
      return undefined
    }

    isLoggingOutRef.current = false

    const initialActivityAt = Math.max(
      readStoredActivityAt() ?? 0,
      Date.now(),
    )

    lastActivityAtRef.current = initialActivityAt
    persistActivityAt(initialActivityAt, { force: true })
    scheduleLogout(initialActivityAt)

    const handleActivity = () => {
      markActivity(Date.now())
    }

    const handleFocusReturn = () => {
      syncStoredActivity()

      if (Date.now() - lastActivityAtRef.current >= getIdleTimeoutMs(user)) {
        void handleInactivityLogout()
        return
      }

      markActivity(Date.now(), { force: true })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleFocusReturn()
      }
    }

    const handleStorage = (event) => {
      if (event.key !== activityStorageKey) {
        return
      }

      const nextActivityAt = parseActivityTimestamp(event.newValue)

      if (
        nextActivityAt != null &&
        nextActivityAt > lastActivityAtRef.current
      ) {
        lastActivityAtRef.current = nextActivityAt
        lastPersistedActivityAtRef.current = nextActivityAt
        scheduleLogout(nextActivityAt)
      }
    }

    INACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true })
    })
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocusReturn)
    window.addEventListener('storage', handleStorage)

    return () => {
      clearLogoutTimer()
      INACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocusReturn)
      window.removeEventListener('storage', handleStorage)
    }
  }, [
    activityStorageKey,
    clearLogoutTimer,
    handleInactivityLogout,
    isAuthReady,
    markActivity,
    persistActivityAt,
    readStoredActivityAt,
    scheduleLogout,
    syncStoredActivity,
    user,
  ])

  useEffect(() => {
    if (!isAuthReady || !user?.id) {
      return
    }

    markActivity(Date.now(), { force: true })
  }, [isAuthReady, location.key, markActivity, user?.id])

  return null
}

export default SessionInactivityMonitor
