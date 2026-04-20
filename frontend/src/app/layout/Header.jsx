import { useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../../features/auth/hooks/useAuth'

const routeMeta = {
  '/app/dashboard': {
    title: 'Dashboard',
  },
  '/app/pos': {
    title: 'POS',
  },
  '/app/inventory': {
    title: 'Inventory',
  },
  '/app/reports': {
    title: 'Reports',
  },
  '/app/products': {
    title: 'Products',
  },
  '/app/users': {
    title: 'Users',
  },
}

function Header({ isSidebarOpen, onOpenSidebar, menuButtonRef }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { logout, user } = useAuth()
  const meta = routeMeta[pathname] || {
    title: 'Samgyupsal POS',
  }

  const currentUser = {
    name: user?.name || 'Admin User',
    role: user?.role || 'Administrator',
    branchName: user?.branchName || 'All Branches',
  }

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <header className="app-header">
      <div className="app-header-primary">
        <button
          ref={menuButtonRef}
          type="button"
          className="sidebar-toggle"
          onClick={onOpenSidebar}
          aria-label="Open navigation menu"
          aria-expanded={isSidebarOpen}
          aria-controls="app-sidebar"
        >
          <span />
          <span />
          <span />
        </button>

        <div className="app-header-copy">
          <h2>{meta.title}</h2>
        </div>
      </div>

      <div className="app-header-copy">
        <h2 className="app-header-title-desktop">{meta.title}</h2>
      </div>

      <div className="header-actions">
        <div className="user-label">
          <strong>{currentUser.name}</strong>
          <div className="user-label-meta">
            <span>{currentUser.role}</span>
            <span>{currentUser.branchName}</span>
          </div>
        </div>
        <button
          type="button"
          className="logout-button"
          onClick={handleLogout}
        >
          Sign Out
        </button>
      </div>
    </header>
  )
}

export default Header
