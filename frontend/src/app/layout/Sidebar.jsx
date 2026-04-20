import { NavLink, useNavigate } from 'react-router-dom'
import useAuth from '../../features/auth/hooks/useAuth'
import { getRoleLabel, isAdminUser, getVisibleNavItems } from '../../shared/utils/permissions'

function Sidebar({ isOpen = false, onClose }) {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const navItems = getVisibleNavItems(user)
  const roleLabel = getRoleLabel(user?.roleKey || user?.role)
  const branchLabel = isAdminUser(user)
    ? 'All branches'
    : user?.branchName || 'Branch pending'

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <aside
      id="app-sidebar"
      className={isOpen ? 'sidebar sidebar-open' : 'sidebar'}
      aria-label="Primary navigation"
    >
      <div className="sidebar-brand">
        <div className="sidebar-brand-row">
          <div>
            <p className="sidebar-eyebrow">Samgyupsal POS</p>
            <h2 className="sidebar-title">Menu</h2>
          </div>

          <button
            type="button"
            className="sidebar-close-button"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            Close
          </button>
        </div>

        <div className="sidebar-scope">
          <span className="sidebar-scope-chip">{roleLabel}</span>
          <span className="sidebar-scope-note">{branchLabel}</span>
        </div>
      </div>

      <div className="sidebar-nav-group">
        <nav className="sidebar-nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-session">
        <div className="sidebar-session-copy">
          <strong>{user?.name || 'Current User'}</strong>
          <span>{roleLabel}</span>
          <span>{branchLabel}</span>
        </div>

        <button
          type="button"
          className="logout-button sidebar-logout-button"
          onClick={handleLogout}
        >
          Sign Out
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
