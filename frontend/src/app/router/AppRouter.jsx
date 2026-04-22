import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Loader from '../../shared/components/common/Loader'
import useAuth from '../../features/auth/hooks/useAuth'
import ProtectedRoute from './ProtectedRoute'
import PublicRoute from './PublicRoute'
import {
  getDefaultAppPath,
  ROLE_ADMIN,
  ROLE_EMPLOYEE,
} from '../../shared/utils/permissions'

const MainLayout = lazy(() => import('../layout/MainLayout'))
const LandingPage = lazy(() => import('../../features/public/pages/LandingPage'))
const DashboardPage = lazy(() => import('../../features/dashboard/pages/DashboardPage'))
const InventoryPage = lazy(() => import('../../features/inventory/pages/InventoryPage'))
const LoginPage = lazy(() => import('../../features/auth/pages/LoginPage'))
const SignUpPage = lazy(() => import('../../features/auth/pages/SignUpPage'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))
const PosPage = lazy(() => import('../../features/pos/pages/PosPage'))
const ProductsPage = lazy(() => import('../../features/products/pages/ProductsPage'))
const ReportsPage = lazy(() => import('../../features/reports/pages/ReportsPage'))
const UsersPage = lazy(() => import('../../features/users/pages/UsersPage'))

function renderLazyPage(element, message) {
  return (
    <Suspense fallback={<Loader message={message} />}>
      {element}
    </Suspense>
  )
}

function AppRouter() {
  const { user } = useAuth()
  const defaultAppPath = getDefaultAppPath(user)

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <PublicRoute>
              {renderLazyPage(<LandingPage />, 'Loading home page...')}
            </PublicRoute>
          }
        />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              {renderLazyPage(<LoginPage />, 'Loading sign-in...')}
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              {renderLazyPage(<SignUpPage />, 'Loading registration...')}
            </PublicRoute>
          }
        />
        <Route path="/register" element={<Navigate to="/signup" replace />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              {renderLazyPage(<MainLayout />, 'Loading workspace...')}
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to={defaultAppPath} replace />} />
          <Route
            path="dashboard"
            element={
              <ProtectedRoute allowedRoles={[ROLE_ADMIN, ROLE_EMPLOYEE]}>
                {renderLazyPage(<DashboardPage />, 'Loading dashboard...')}
              </ProtectedRoute>
            }
          />
          <Route
            path="pos"
            element={
              <ProtectedRoute allowedRoles={[ROLE_EMPLOYEE]}>
                {renderLazyPage(<PosPage />, 'Loading sales workspace...')}
              </ProtectedRoute>
            }
          />
          <Route
            path="inventory"
            element={
              <ProtectedRoute allowedRoles={[ROLE_ADMIN, ROLE_EMPLOYEE]}>
                {renderLazyPage(<InventoryPage />, 'Loading inventory...')}
              </ProtectedRoute>
            }
          />
          <Route
            path="reports"
            element={
              <ProtectedRoute allowedRoles={[ROLE_ADMIN]}>
                {renderLazyPage(<ReportsPage />, 'Loading reports...')}
              </ProtectedRoute>
            }
          />
          <Route
            path="products"
            element={
              <ProtectedRoute allowedRoles={[ROLE_ADMIN]}>
                {renderLazyPage(<ProductsPage />, 'Loading products...')}
              </ProtectedRoute>
            }
          />
          <Route
            path="users"
            element={
              <ProtectedRoute allowedRoles={[ROLE_ADMIN]}>
                {renderLazyPage(<UsersPage />, 'Loading users...')}
              </ProtectedRoute>
            }
          />
        </Route>

        <Route
          path="*"
          element={renderLazyPage(<NotFoundPage />, 'Loading page...')}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
