export function peso(value) {
  const amount = Number(value || 0)

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount)
}

export function shortDate(dateString) {
  if (!dateString) {
    return '-'
  }

  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export function shortDateTime(dateString) {
  if (!dateString) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export function quantityLabel(qty, unit = 'pcs') {
  const labelUnit = String(unit || 'pcs').trim() || 'pcs'
  return `${Number(qty || 0)} ${labelUnit}`
}
