import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import '../styles/layout.css'

function MainLayout() {
  const { pathname } = useLocation()
  const menuButtonRef = useRef(null)
  const [sidebarPath, setSidebarPath] = useState(null)
  const isSidebarOpen = sidebarPath === pathname

  const openSidebar = () => {
    setSidebarPath(pathname)
  }

  const closeSidebar = (returnFocus = false) => {
    setSidebarPath(null)

    if (returnFocus) {
      window.setTimeout(() => {
        menuButtonRef.current?.focus()
      }, 0)
    }
  }

  useEffect(() => {
    if (!isSidebarOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      closeSidebar(true)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSidebarOpen])

  return (
    <div className={isSidebarOpen ? 'app-shell app-shell--sidebar-open' : 'app-shell'}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => closeSidebar(true)}
      />

      <button
        type="button"
        className={isSidebarOpen ? 'sidebar-backdrop sidebar-backdrop-open' : 'sidebar-backdrop'}
        onClick={() => closeSidebar(true)}
        aria-label="Close navigation menu"
      />

      <div className="main-area">
        <Header
          isSidebarOpen={isSidebarOpen}
          onOpenSidebar={openSidebar}
          menuButtonRef={menuButtonRef}
        />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default MainLayout
