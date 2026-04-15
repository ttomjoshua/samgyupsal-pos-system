import { NavLink } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { isAdminUser, getVisibleNavItems } from '../utils/permissions'

function Sidebar() {
  const { user } = useAuth()
  const navItems = getVisibleNavItems(user)
  const scopeCopy = isAdminUser(user)
    ? 'Full admin access across every branch and management screen.'
    : `Assigned branch: ${user?.branchName || 'Unassigned Branch'}`

  return (
    <aside className="sidebar">
      <h2 className="sidebar-title">G SAMGYUPSAL & KOREAN FOOD</h2>
      <p className="sidebar-copy">{scopeCopy}</p>

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
    </aside>
  )
}

export default Sidebar
