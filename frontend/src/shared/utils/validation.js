function collapseWhitespace(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function parseNumericInput(value) {
  if (value === '' || value == null) {
    return NaN
  }

  return Number(value)
}

function isWholeNumber(value) {
  return Number.isInteger(parseNumericInput(value))
}

export function normalizeSearchInput(value) {
  return collapseWhitespace(value)
}

export function getFirstValidationError(errors = {}) {
  return Object.values(errors)[0] || ''
}

export function validateLoginForm(formData = {}, options = {}) {
  const useEmail = options.useEmail === true
  const username = collapseWhitespace(formData.username)
  const email = collapseWhitespace(formData.email).toLowerCase()
  const password = String(formData.password || '')
  const errors = {}

  if (useEmail) {
    if (!email) {
      errors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address.'
    }
  } else if (!username) {
    errors.username = 'Username is required.'
  }

  if (!password.trim()) {
    errors.password = 'Password is required.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData: {
      email,
      username,
      password,
    },
  }
}

export function validateCheckout({
  paymentMethod,
  amountReceived,
  totalAmount,
  cartItems,
  discount = 0,
  subtotalAmount = null,
} = {}) {
  const errors = {}
  const normalizedPaymentMethod = String(paymentMethod || '').trim().toLowerCase()
  const numericDiscount = Number(discount || 0)

  if (!normalizedPaymentMethod) {
    errors.paymentMethod = 'Select a payment method.'
  }

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    errors.cart = 'Cart cannot be empty.'
  }

  if (!errors.cart && Array.isArray(cartItems)) {
    for (const cartItem of cartItems) {
      const quantity = parseNumericInput(cartItem?.quantity)
      const availableStock = parseNumericInput(
        cartItem?.stockQuantity ?? cartItem?.stock_quantity,
      )
      const itemName =
        String(cartItem?.name || cartItem?.item_name || 'This item').trim() ||
        'This item'

      if (!Number.isInteger(quantity) || quantity <= 0) {
        errors.cart = 'Cart quantities must be whole numbers greater than zero.'
        break
      }

      if (
        Number.isFinite(availableStock) &&
        availableStock >= 0 &&
        quantity > availableStock
      ) {
        errors.cart = `${itemName} only has ${availableStock} item${
          availableStock === 1 ? '' : 's'
        } in stock.`
        break
      }
    }
  }

  if (Number.isNaN(numericDiscount) || numericDiscount < 0) {
    errors.discount = 'Discount cannot be negative.'
  }

  if (subtotalAmount != null && numericDiscount > Number(subtotalAmount || 0)) {
    errors.discount = 'Discount cannot be greater than the subtotal.'
  }

  if (normalizedPaymentMethod === 'cash') {
    const normalizedAmount =
      amountReceived === '' || amountReceived == null ? NaN : Number(amountReceived)

    if (Number.isNaN(normalizedAmount)) {
      errors.amountReceived = 'Amount received is required for cash payments.'
    } else if (normalizedAmount < Number(totalAmount || 0)) {
      errors.amountReceived =
        'Amount received must be equal to or greater than total amount.'
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

export function validateInventoryForm(formData = {}) {
  const productName = collapseWhitespace(formData.product_name || formData.name)
  const categoryName = collapseWhitespace(formData.category_name || formData.category)
  const stockQuantity = formData.stock_quantity ?? formData.stock
  const unit = collapseWhitespace(formData.unit)
  const expiryDate = String(formData.expiry_date || '').trim()
  const reorderLevel = formData.reorder_level ?? 0
  const priceValue = formData.price
  const errors = {}

  if (!productName) {
    errors.name = 'Product name is required.'
  }

  if (!categoryName) {
    errors.category = 'Category is required.'
  }

  if (stockQuantity === '' || stockQuantity == null) {
    errors.stock = 'Stock quantity is required.'
  } else if (!isWholeNumber(stockQuantity)) {
    errors.stock = 'Stock quantity must be a whole number.'
  } else if (Number(stockQuantity) < 0) {
    errors.stock = 'Stock cannot be negative.'
  }

  if (!unit) {
    errors.unit = 'Unit is required.'
  }

  if (!expiryDate) {
    errors.expiryDate = 'Expiry date is required.'
  }

  if (priceValue === undefined || priceValue === null || String(priceValue).trim() === '') {
    errors.price = 'Price is required.'
  } else if (Number(priceValue) <= 0) {
    errors.price = 'Price must be greater than zero.'
  }

  if (String(reorderLevel).trim() !== '' && Number(reorderLevel) < 0) {
    errors.reorderLevel = 'Reorder level cannot be negative.'
  } else if (String(reorderLevel).trim() !== '' && !isWholeNumber(reorderLevel)) {
    errors.reorderLevel = 'Reorder level must be a whole number.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData: {
      ...formData,
      product_name: productName,
      category_name: categoryName,
      price: Number(priceValue),
      stock_quantity: Number(stockQuantity),
      unit,
      expiry_date: expiryDate,
      reorder_level: Number(reorderLevel ?? 0),
    },
  }
}

export function validateInventoryQuantityAction({
  selectedItem,
  quantityValue,
  mode,
} = {}) {
  const errors = {}
  const sanitizedAmount = Number(quantityValue)

  if (!selectedItem) {
    errors.quantity = 'Select an inventory item first.'
  } else if (!Number.isInteger(sanitizedAmount) || sanitizedAmount === 0) {
    errors.quantity = 'Enter a whole number stock quantity to continue.'
  } else if (mode === 'stock-in' && sanitizedAmount < 0) {
    errors.quantity = 'Stock in only accepts a positive quantity.'
  } else if (
    mode === 'adjust-stock' &&
    Number(selectedItem.stock_quantity) + sanitizedAmount < 0
  ) {
    errors.quantity = 'Adjusted stock cannot go below zero.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedAmount,
  }
}

export function validateReportDateRange({ dateFrom, dateTo } = {}) {
  const errors = {}
  const normalizedFrom = String(dateFrom || '').trim()
  const normalizedTo = String(dateTo || '').trim()

  if (!normalizedFrom) {
    errors.dateFrom = 'Start date is required.'
  }

  if (!normalizedTo) {
    errors.dateTo = 'End date is required.'
  }

  if (normalizedFrom && normalizedTo && normalizedFrom > normalizedTo) {
    errors.dateRange = 'Start date must be earlier than or equal to end date.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
