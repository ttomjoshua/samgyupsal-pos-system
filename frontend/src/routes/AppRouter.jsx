import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Loader from '../components/common/Loader'
import MainLayout from '../layout/MainLayout'
import DashboardPage from '../pages/DashboardPage'
import InventoryPage from '../pages/InventoryPage'
import LoginPage from '../pages/LoginPage'
import NotFoundPage from '../pages/NotFoundPage'
import PosPage from '../pages/PosPage'
import ProductsPage from '../pages/ProductsPage'
import ReportsPage from '../pages/ReportsPage'
import UsersPage from '../pages/UsersPage'
import useAuth from '../hooks/useAuth'
import ProtectedRoute from './ProtectedRoute'
import { getDefaultAppPath, ROLE_ADMIN } from '../utils/permissions'

function AppRouter() {
  const { isAuthenticated, isAuthReady, user } = useAuth()
  const defaultAppPath = getDefaultAppPath(user)

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            !isAuthReady ? (
              <Loader message="Restoring your session..." />
            ) : isAuthenticated ? (
              <Navigate to={defaultAppPath} replace />
            ) : (
              <LoginPage />
            )
          }
        />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to={defaultAppPath} replace />} />
          <Route
            path="dashboard"
            element={
              <ProtectedRoute allowedRoles={[ROLE_ADMIN]}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="pos" element={<PosPage />} />
          <Route
            path="inventory"
            element={
              <ProtectedRoute allowedRoles={[ROLE_ADMIN]}>
                <InventoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports"
            element={
              <ProtectedRoute allowedRoles={[ROLE_ADMIN]}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="products"
            element={
              <ProtectedRoute allowedRoles={[ROLE_ADMIN]}>
                <ProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="users"
            element={
              <ProtectedRoute allowedRoles={[ROLE_ADMIN]}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
