import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import '../styles/layout.css'

function MainLayout() {
  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main-area">
        <Header />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default MainLayout
