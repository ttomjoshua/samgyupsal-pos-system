import { useEffect, useId, useRef } from 'react'
import '../../styles/modal.css'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(container) {
  if (!container) {
    return []
  }

  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((element) => (
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      typeof element.focus === 'function'
    ))
}

function Modal({
  isOpen,
  title,
  eyebrow,
  description,
  onClose,
  children,
  width = '720px',
  closeLabel = 'Close dialog',
  panelClassName = '',
  bodyClassName = '',
}) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef(null)
  const closeButtonRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    previousFocusRef.current = document.activeElement
    document.body.style.overflow = 'hidden'

    window.setTimeout(() => {
      const focusableElements = getFocusableElements(panelRef.current)
      const firstFocusableElement = focusableElements[0] || closeButtonRef.current

      firstFocusableElement?.focus()
    }, 0)

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current?.()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusableElements = getFocusableElements(panelRef.current)

      if (focusableElements.length === 0) {
        event.preventDefault()
        panelRef.current?.focus()
        return
      }

      const firstFocusableElement = focusableElements[0]
      const lastFocusableElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstFocusableElement) {
        event.preventDefault()
        lastFocusableElement.focus()
        return
      }

      if (!event.shiftKey && document.activeElement === lastFocusableElement) {
        event.preventDefault()
        firstFocusableElement.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)

      if (
        previousFocusRef.current &&
        previousFocusRef.current !== document.body &&
        typeof previousFocusRef.current.focus === 'function' &&
        previousFocusRef.current.isConnected
      ) {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={panelClassName ? `modal-panel ${panelClassName}` : 'modal-panel'}
        style={{ maxWidth: width }}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-copy">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId}>{title}</h2>
            {description ? (
              <p
                id={descriptionId}
                className="supporting-text"
              >
                {description}
              </p>
            ) : null}
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M7 7l10 10M17 7 7 17"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </button>
        </div>

        <div className={bodyClassName ? `modal-body ${bodyClassName}` : 'modal-body'}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default Modal
