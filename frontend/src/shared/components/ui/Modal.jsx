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
}) {
  const titleId = useId()

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
        className="modal-panel"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-copy">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId}>{title}</h2>
            {description ? <p className="supporting-text">{description}</p> : null}
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export default Modal
