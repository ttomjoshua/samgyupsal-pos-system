import { useId } from 'react'
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
