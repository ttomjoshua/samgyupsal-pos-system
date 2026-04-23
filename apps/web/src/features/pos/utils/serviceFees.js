export const SERVICE_FEE_PREFIX = 'Service Fee - '
export const serviceFeeOptions = [
  {
    value: 'self_service_cooking',
    label: 'Self-Service Cooking',
    amount: 10,
    note: 'Standard for ramen and noodles',
    itemName: `${SERVICE_FEE_PREFIX}Self-Service Cooking`,
  },
  {
    value: 'microwave_usage',
    label: 'Microwave Usage',
    amount: 5,
    note: 'Optional reheating fee',
    itemName: `${SERVICE_FEE_PREFIX}Microwave Usage`,
  },
]

export function isServiceFeeLineItem(item = {}) {
  const lineName = String(
    item.item_name || item.itemName || item.name || item.item || '',
  )
    .trim()
    .toLowerCase()

  return (
    item.is_service_fee === true ||
    lineName.startsWith(SERVICE_FEE_PREFIX.toLowerCase())
  )
}

export function buildServiceFeeLineItems(selectedFees = []) {
  const selectedFeeKeys = new Set(selectedFees)

  return serviceFeeOptions
    .filter((option) => selectedFeeKeys.has(option.value))
    .map((option) => ({
      product_id: null,
      quantity: 1,
      unit_price: Number(option.amount),
      line_total: Number(option.amount),
      item_name: option.itemName,
      is_service_fee: true,
      fee_key: option.value,
    }))
}
