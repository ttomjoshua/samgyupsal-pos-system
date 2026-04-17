export function resolveInventoryRecordIds(item = {}) {
  const inventoryItemId = Number(
    item.inventory_item_id ?? item.inventoryItemId ?? item.id ?? NaN,
  )
  const productId = Number(item.product_id ?? item.productId ?? item.id ?? NaN)

  return {
    inventoryItemId: Number.isFinite(inventoryItemId) ? inventoryItemId : null,
    productId: Number.isFinite(productId) ? productId : null,
  }
}
