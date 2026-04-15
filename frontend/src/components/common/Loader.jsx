function Loader({ message = 'Loading...' }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <span className="loader-spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

export default Loader
