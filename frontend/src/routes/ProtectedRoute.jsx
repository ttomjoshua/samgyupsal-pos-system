import { Navigate } from 'react-router-dom'
import Loader from '../components/common/Loader'
import useAuth from '../hooks/useAuth'
import { getDefaultAppPath, normalizeRoleKey } from '../utils/permissions'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthReady } = useAuth()

  if (!isAuthReady) {
    return <Loader message="Restoring your session..." />
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (
    Array.isArray(allowedRoles) &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(normalizeRoleKey(user))
  ) {
    return <Navigate to={getDefaultAppPath(user)} replace />
  }

  return children
}
