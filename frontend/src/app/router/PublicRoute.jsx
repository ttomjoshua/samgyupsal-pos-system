import { Navigate } from 'react-router-dom'
import Loader from '../../shared/components/common/Loader'
import useAuth from '../../features/auth/hooks/useAuth'
import { getDefaultAppPath } from '../../shared/utils/permissions'

function PublicRoute({ children }) {
  const { isAuthenticated, isAuthReady, user } = useAuth()

  if (!isAuthReady) {
    return <Loader message="Restoring your session..." />
  }

  if (isAuthenticated) {
    return <Navigate to={getDefaultAppPath(user)} replace />
  }

  return children
}

export default PublicRoute
