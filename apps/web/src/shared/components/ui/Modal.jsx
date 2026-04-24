import { useEffect, useId, useRef } from 'react'
import '../../styles/modal.css'

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
  const closeButtonRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => {
      if (document.activeElement === document.body) {
        closeButtonRef.current?.focus()
      }
    }, 0)

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
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
        className={panelClassName ? `modal-panel ${panelClassName}` : 'modal-panel'}
        style={{ maxWidth: width }}
        role="dialog"
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
