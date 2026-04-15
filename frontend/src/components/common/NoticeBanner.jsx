function NoticeBanner({ title, message, variant = 'info' }) {
  const classes = `notice-banner notice-banner--${variant}`

  return (
    <div className={classes} role={variant === 'error' ? 'alert' : 'status'}>
      {title ? <strong>{title}</strong> : null}
      {message ? <p>{message}</p> : null}
    </div>
  )
}

export default NoticeBanner
