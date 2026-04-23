function StatusBadge({ text, variant = 'default', label, tone }) {
  const badgeText = text || label
  const badgeVariant = variant !== 'default' ? variant : tone || 'normal'

  return (
    <span className={`status-badge status-badge--${badgeVariant}`}>
      {badgeText}
    </span>
  )
}

export default StatusBadge
