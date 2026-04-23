function formatDateInput(value) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDefaultReportDateRange(referenceDate = new Date(), dayWindow = 14) {
  const normalizedReferenceDate = new Date(referenceDate)

  if (Number.isNaN(normalizedReferenceDate.getTime())) {
    return getDefaultReportDateRange(new Date(), dayWindow)
  }

  normalizedReferenceDate.setHours(0, 0, 0, 0)

  const totalDays = Math.max(1, Number(dayWindow) || 14)
  const startDate = new Date(normalizedReferenceDate)
  startDate.setDate(normalizedReferenceDate.getDate() - totalDays + 1)

  return {
    dateFrom: formatDateInput(startDate),
    dateTo: formatDateInput(normalizedReferenceDate),
  }
}
