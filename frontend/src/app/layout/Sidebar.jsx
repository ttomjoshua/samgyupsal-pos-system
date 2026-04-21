import { forwardRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import useAuth from '../../features/auth/hooks/useAuth'
import { getRoleLabel, isAdminUser, getVisibleNavItems } from '../../shared/utils/permissions'

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.8" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
    </svg>
  )
}

function PosIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5z" />
      <path d="M8 9h8" />
      <path d="M8 12h2" />
      <path d="M12 12h4" />
      <path d="M8 15h3" />
    </svg>
  )
}

function InventoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4.5 8.5 12 4l7.5 4.5L12 13z" />
      <path d="M4.5 8.5V16L12 20l7.5-4V8.5" />
      <path d="M12 13v7" />
    </svg>
  )
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6.5 18.5h11" />
      <path d="M8.5 15V11" />
      <path d="M12 15V8" />
      <path d="M15.5 15v-5" />
      <path d="M5.5 4.5h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

function ProductsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 7.5h12" />
      <path d="M9 7.5V5.8a2.2 2.2 0 0 1 2.2-2.2h1.6A2.2 2.2 0 0 1 15 5.8v1.7" />
      <path d="M5 7.5h14l-.9 10.2A2.2 2.2 0 0 1 15.9 20H8.1a2.2 2.2 0 0 1-2.2-2.3z" />
      <path d="M10 11.5v4" />
      <path d="M14 11.5v4" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
      <path d="M18 8a2.4 2.4 0 1 1 1.7 4.1" />
      <path d="M4.3 12.1A2.4 2.4 0 1 1 6 8" />
    </svg>
  )
}

function SidebarToggleIcon({ isDesktop, isCollapsed }) {
  const chevronPath = !isDesktop || !isCollapsed ? 'M14.5 8.5 11 12l3.5 3.5' : 'M10.5 8.5 14 12l-3.5 3.5'

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M8.5 6.5v11" strokeLinecap="round" />
      <path d={chevronPath} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const NAV_ICONS = {
  dashboard: DashboardIcon,
  pos: PosIcon,
  inventory: InventoryIcon,
  reports: ReportsIcon,
  products: ProductsIcon,
  users: UsersIcon,
}

const Sidebar = forwardRef(function Sidebar(
  {
    isDesktop,
    isOpen = false,
    isCollapsed = false,
    onToggle,
    onCloseMobile,
  },
  ref
) {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const [tooltip, setTooltip] = useState(null)
  const navItems = getVisibleNavItems(user)
  const roleLabel = getRoleLabel(user?.roleKey || user?.role)
  const branchLabel = isAdminUser(user)
    ? 'All branches'
    : user?.branchName || 'Branch pending'
  const toggleLabel = isDesktop
    ? isCollapsed
      ? 'Expand navigation sidebar'
      : 'Collapse navigation sidebar'
    : 'Close navigation menu'

  const sidebarClassName = [
    'sidebar',
    isDesktop ? 'sidebar-desktop' : 'sidebar-mobile',
    isCollapsed ? 'sidebar-collapsed' : '',
    !isDesktop && isOpen ? 'sidebar-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const handleNavigate = () => {
    setTooltip(null)

    if (!isDesktop) {
      onCloseMobile(false)
    }
  }

  const handleToggle = () => {
    setTooltip(null)
    onToggle()
  }

  const handleLogout = async () => {
    setTooltip(null)
    await logout()
    navigate('/', { replace: true })
  }

  const handleShowTooltip = (event, label) => {
    if (!isDesktop || !isCollapsed) {
      return
    }

    const { top, right, height } = event.currentTarget.getBoundingClientRect()

    setTooltip({
      label,
      top: top + height / 2,
      left: right + 14,
    })
  }

  const handleHideTooltip = () => {
    setTooltip(null)
  }

  return (
    <aside
      id="app-sidebar"
      ref={ref}
      className={sidebarClassName}
      aria-label="Primary navigation"
      aria-hidden={!isDesktop && !isOpen}
      tabIndex={-1}
    >
      <div className="sidebar-brand">
        <div className="sidebar-brand-row">
          <div className="sidebar-brand-main">
            <div className="sidebar-brand-mark" aria-hidden="true">
              SP
            </div>

            <div className="sidebar-brand-copy">
              <p className="sidebar-eyebrow">Samgyupsal POS</p>
              <h2 className="sidebar-title">Menu</h2>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-control-button"
            onClick={handleToggle}
            aria-label={toggleLabel}
            aria-expanded={isDesktop ? !isCollapsed : isOpen}
            aria-controls="app-sidebar"
          >
            <SidebarToggleIcon isDesktop={isDesktop} isCollapsed={isCollapsed} />
          </button>
        </div>

        <div className="sidebar-scope" aria-hidden={isCollapsed}>
          <span className="sidebar-scope-chip">{roleLabel}</span>
          <span className="sidebar-scope-note">{branchLabel}</span>
        </div>
      </div>

      <div className="sidebar-nav-group" onScroll={handleHideTooltip}>
        <nav className="sidebar-nav" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = NAV_ICONS[item.key] || DashboardIcon

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={handleNavigate}
                onMouseEnter={(event) => handleShowTooltip(event, item.label)}
                onMouseLeave={handleHideTooltip}
                onFocus={(event) => handleShowTooltip(event, item.label)}
                onBlur={handleHideTooltip}
                aria-label={item.label}
                className={({ isActive }) =>
                  isActive ? 'sidebar-link active' : 'sidebar-link'
                }
              >
                <span className="sidebar-link-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="sidebar-link-label">{item.label}</span>
              </NavLink>
            )
          })}
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

      {isDesktop && isCollapsed && tooltip ? (
        <div
          className="sidebar-tooltip"
          role="tooltip"
          style={{
            top: `${tooltip.top}px`,
            left: `${tooltip.left}px`,
          }}
        >
          {tooltip.label}
        </div>
      ) : null}
    </aside>
  )
})

export default Sidebar
