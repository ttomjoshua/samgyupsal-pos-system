export const DISCOUNT_TYPE_NONE = 'none'
export const DEFAULT_DISCOUNT_TYPE = DISCOUNT_TYPE_NONE

export const discountOptions = [
  {
    value: DISCOUNT_TYPE_NONE,
    label: 'No Discount',
    rate: 0,
  },
  {
    value: 'senior-citizen',
    label: 'Senior Citizen',
    rate: 0.2,
  },
  {
    value: 'pwd',
    label: 'PWD',
    rate: 0.2,
  },
]

export function getDiscountConfig(discountType = DEFAULT_DISCOUNT_TYPE) {
  return (
    discountOptions.find((option) => option.value === discountType) ||
    discountOptions[0]
  )
}

export function calculateDiscountAmount(
  subtotal = 0,
  discountType = DEFAULT_DISCOUNT_TYPE,
) {
  const numericSubtotal = Number(subtotal || 0)

  if (!Number.isFinite(numericSubtotal) || numericSubtotal <= 0) {
    return 0
  }

  const { rate = 0 } = getDiscountConfig(discountType)
  return Number((numericSubtotal * rate).toFixed(2))
}
