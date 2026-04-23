import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import '../styles/layout.css'

const DESKTOP_MEDIA_QUERY = '(min-width: 1041px)'
const SIDEBAR_STORAGE_KEY = 'samgyupsal:sidebar-collapsed'

function getInitialDesktopState() {
  if (typeof window === 'undefined') {
    return true
  }

  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches
}

function getInitialCollapsedState() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
}

function getFocusableElements(container) {
  if (!container) {
    return []
  }

  return Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => {
    if (element.getAttribute('aria-hidden') === 'true') {
      return false
    }

    return element.offsetParent !== null
  })
}

function MainLayout() {
  const { pathname } = useLocation()
  const menuButtonRef = useRef(null)
  const sidebarRef = useRef(null)
  const [isDesktop, setIsDesktop] = useState(getInitialDesktopState)
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(getInitialCollapsedState)
  const [mobileSidebarPath, setMobileSidebarPath] = useState(null)

  const isSidebarCollapsed = isDesktop && isDesktopCollapsed
  const isMobileSidebarOpen = !isDesktop && mobileSidebarPath === pathname
  const isSidebarOpen = isDesktop || isMobileSidebarOpen

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY)

    const handleViewportChange = (event) => {
      setIsDesktop(event.matches)
      setMobileSidebarPath(null)
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange)

      return () => {
        mediaQuery.removeEventListener('change', handleViewportChange)
      }
    }

    mediaQuery.addListener(handleViewportChange)

    return () => {
      mediaQuery.removeListener(handleViewportChange)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      String(isDesktopCollapsed)
    )
  }, [isDesktopCollapsed])

  useEffect(() => {
    if (isDesktop || !isMobileSidebarOpen) {
      return undefined
    }

    const sidebarElement = sidebarRef.current
    const previousOverflow = document.body.style.overflow
    const focusableElements = getFocusableElements(sidebarElement)

    document.body.style.overflow = 'hidden'

    window.requestAnimationFrame(() => {
      ;(focusableElements[0] || sidebarElement)?.focus()
    })

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMobileSidebarPath(null)
        window.setTimeout(() => {
          menuButtonRef.current?.focus()
        }, 0)
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const currentFocusableElements = getFocusableElements(sidebarElement)

      if (!currentFocusableElements.length) {
        event.preventDefault()
        sidebarElement?.focus()
        return
      }

      const firstElement = currentFocusableElements[0]
      const lastElement = currentFocusableElements[currentFocusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
        return
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDesktop, isMobileSidebarOpen])

  const openSidebar = () => {
    if (isDesktop) {
      setIsDesktopCollapsed(false)
      return
    }

    setMobileSidebarPath(pathname)
  }

  const closeMobileSidebar = (returnFocus = false) => {
    setMobileSidebarPath(null)

    if (!returnFocus) {
      return
    }

    window.setTimeout(() => {
      menuButtonRef.current?.focus()
    }, 0)
  }

  const toggleSidebar = () => {
    if (isDesktop) {
      setIsDesktopCollapsed((currentValue) => !currentValue)
      return
    }

    closeMobileSidebar(true)
  }

  const shellClassName = [
    'app-shell',
    isSidebarCollapsed ? 'app-shell--sidebar-collapsed' : '',
    !isDesktop && isMobileSidebarOpen ? 'app-shell--sidebar-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClassName}>
      <Sidebar
        ref={sidebarRef}
        isDesktop={isDesktop}
        isOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onToggle={toggleSidebar}
        onCloseMobile={closeMobileSidebar}
      />

      <button
        type="button"
        className={isMobileSidebarOpen ? 'sidebar-backdrop sidebar-backdrop-open' : 'sidebar-backdrop'}
        onClick={() => closeMobileSidebar(true)}
        aria-label="Close navigation menu"
        tabIndex={isMobileSidebarOpen ? 0 : -1}
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
