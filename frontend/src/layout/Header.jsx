import { useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

const routeMeta = {
  '/app/dashboard': {
    title: 'Dashboard',
    description: 'Operational summary and quick access to the main business screens.',
  },
  '/app/pos': {
    title: 'POS',
    description: 'Live register workspace for branch checkout and order processing.',
  },
  '/app/inventory': {
    title: 'Inventory',
    description: 'Stock control, replenishment, and expiry monitoring.',
  },
  '/app/reports': {
    title: 'Reports',
    description: 'Sales performance, cashier activity, and restock visibility.',
  },
  '/app/products': {
    title: 'Products',
    description: 'Catalog structure, categories, and branch-ready product visibility.',
  },
  '/app/users': {
    title: 'Users',
    description: 'Branch directory, employee access, and account status control.',
  },
}

function Header() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { logout, user } = useAuth()
  const meta = routeMeta[pathname] || {
    title: 'Samgyupsal POS',
    description: 'Business operations workspace.',
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
      <div className="app-header-copy">
        <p className="eyebrow">Workspace</p>
        <h2>{meta.title}</h2>
        <p className="supporting-text">{meta.description}</p>
      </div>

      <div className="header-actions">
        <div className="user-label">
          <span className="user-label-title">Signed in</span>
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
