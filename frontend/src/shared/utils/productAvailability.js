function getNumericValue(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : NaN
}

export function deriveProductSellability(product = {}) {
  const unitPrice = getNumericValue(
    product.price ?? product.unit_price ?? product.unitPrice ?? product.default_price,
  )
  const stockQuantity = getNumericValue(
    product.stockQuantity ?? product.stock_quantity,
  )
  const isActive =
    product.isSellable === false
      ? false
      : product.is_active !== false && product.isActive !== false

  if (!isActive) {
    return {
      isSellable: false,
      availabilityReason: 'Unavailable',
    }
  }

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return {
      isSellable: false,
      availabilityReason: 'Price not set',
    }
  }

  if (Number.isFinite(stockQuantity) && stockQuantity <= 0) {
    return {
      isSellable: false,
      availabilityReason: 'Out of stock',
    }
  }

  return {
    isSellable: true,
    availabilityReason: '',
  }
}
