import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../../features/auth/hooks/useAuth'

const routeMeta = {
  '/app/dashboard': {
    title: 'Dashboard',
  },
  '/app/pos': {
    title: 'Sales',
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
  const { key: locationKey, pathname } = useLocation()
  const { logout, user } = useAuth()
  const accountPanelRef = useRef(null)
  const accountButtonRef = useRef(null)
  const [openAccountPanelKey, setOpenAccountPanelKey] = useState(null)
  const meta = routeMeta[pathname] || {
    title: 'Samgyupsal POS',
  }
  const isAccountPanelOpen = openAccountPanelKey === locationKey

  const currentUser = {
    name: user?.name || 'Admin User',
    role: user?.role || 'Administrator',
    branchName: user?.branchName || 'All Branches',
  }
  const currentUserInitial = currentUser.name.trim().charAt(0).toUpperCase() || 'U'

  useEffect(() => {
    if (!isAccountPanelOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (
        accountPanelRef.current?.contains(event.target) ||
        accountButtonRef.current?.contains(event.target)
      ) {
        return
      }

      setOpenAccountPanelKey(null)
    }

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      setOpenAccountPanelKey(null)
      accountButtonRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAccountPanelOpen])

  const handleOpenSidebar = () => {
    setOpenAccountPanelKey(null)
    onOpenSidebar()
  }

  const handleToggleAccountPanel = () => {
    setOpenAccountPanelKey((currentValue) =>
      currentValue === locationKey ? null : locationKey
    )
  }

  const handleLogout = async () => {
    setOpenAccountPanelKey(null)
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
          onClick={handleOpenSidebar}
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

        <div className="mobile-session">
          <button
            ref={accountButtonRef}
            type="button"
            className="mobile-session-toggle"
            onClick={handleToggleAccountPanel}
            aria-label="Open account menu"
            aria-expanded={isAccountPanelOpen}
            aria-controls="mobile-session-panel"
          >
            <span className="mobile-session-toggle-avatar" aria-hidden="true">
              {currentUserInitial}
            </span>
            <span className="mobile-session-toggle-label">Account</span>
          </button>

          <div
            ref={accountPanelRef}
            id="mobile-session-panel"
            className={
              isAccountPanelOpen
                ? 'mobile-session-panel mobile-session-panel-open'
                : 'mobile-session-panel'
            }
            aria-label="Mobile account menu"
          >
            <div className="mobile-session-copy">
              <strong>{currentUser.name}</strong>
              <span>{currentUser.role}</span>
              <span>{currentUser.branchName}</span>
            </div>

            <button
              type="button"
              className="logout-button mobile-logout-button"
              onClick={handleLogout}
            >
              Sign Out
            </button>
          </div>
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
