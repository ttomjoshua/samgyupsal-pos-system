import { NavLink } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { getRoleLabel, isAdminUser, getVisibleNavItems } from '../utils/permissions'

function Sidebar() {
  const { user } = useAuth()
  const navItems = getVisibleNavItems(user)
  const roleLabel = getRoleLabel(user?.roleKey || user?.role)
  const scopeCopy = isAdminUser(user)
    ? 'Oversight across branches, catalog, reporting, and staff operations.'
    : `Assigned branch: ${user?.branchName || 'Unassigned Branch'}`

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <p className="sidebar-eyebrow">Samgyupsal POS</p>
        <h2 className="sidebar-title">Business Console</h2>
        <p className="sidebar-copy">{scopeCopy}</p>

        <div className="sidebar-scope">
          <span className="sidebar-scope-chip">{roleLabel}</span>
          <span className="sidebar-scope-note">
            {isAdminUser(user) ? 'All branches' : user?.branchName || 'Branch pending'}
          </span>
        </div>
      </div>

      <div className="sidebar-nav-group">
        <p className="sidebar-nav-label">Navigation</p>
      <nav className="sidebar-nav" aria-label="Primary">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? 'sidebar-link active' : 'sidebar-link'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      </div>
    </aside>
  )
}

export default Sidebar
