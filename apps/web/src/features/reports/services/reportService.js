import { getInventoryItems, isLowStock } from '../../inventory/services/inventoryService'
import { isServiceFeeLineItem } from '../../pos/utils/serviceFees'
import { getSalesRecords } from '../../pos/services/salesService'
import { getDefaultReportDateRange } from '../../../shared/utils/reporting.js'
import { peso, shortDate } from '../../../shared/utils/formatters'
import {
  getCachedResource,
  setCachedResource,
} from '../../../shared/utils/resourceCache'

const REPORTS_CACHE_PREFIX = 'reports:'
const REPORTS_CACHE_TTL_MS = 60 * 1000
const SALES_VELOCITY_WINDOW_DAYS = 30
const STOCKOUT_ALERT_DAYS = 14
const NEAR_EXPIRY_ALERT_DAYS = 30

export { getDefaultReportDateRange }

function getReportCacheKey(options = {}) {
  return `${REPORTS_CACHE_PREFIX}${JSON.stringify({
    branchId: options.branchId ?? null,
    cashierId: options.cashierId ?? null,
    dateFrom: options.dateFrom || '',
    dateTo: options.dateTo || '',
  })}`
}

export function getCachedReportSnapshot(options = {}) {
  return getCachedResource(getReportCacheKey(options), REPORTS_CACHE_TTL_MS)
}

function summarizeSales(sales) {
  return sales.reduce(
    (summary, sale) => {
      summary.totalSales += Number(sale.total_amount || 0)
      summary.transactionCount += 1
      summary.itemsSold += (sale.items || [])
        .filter((item) => !isServiceFeeLineItem(item))
        .reduce((count, item) => count + Number(item.quantity || 0), 0)
      return summary
    },
    {
      totalSales: 0,
      transactionCount: 0,
      itemsSold: 0,
    },
  )
}

function buildTopItems(sales) {
  const itemMap = new Map()

  sales.forEach((sale) => {
    ;(sale.items || [])
      .filter((item) => !isServiceFeeLineItem(item))
      .forEach((item) => {
        const itemName = String(item.item_name || 'Unknown Item').trim() || 'Unknown Item'
        const itemKey = itemName.toLowerCase()
        const existingItem = itemMap.get(itemKey) || {
          id: `local-${itemKey}`,
          item: itemName,
          sold: 0,
          revenue: 0,
        }

        existingItem.sold += Number(item.quantity || 0)
        existingItem.revenue += Number(item.line_total || 0)
        itemMap.set(itemKey, existingItem)
      })
  })

  return Array.from(itemMap.values())
    .sort((left, right) => right.sold - left.sold)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      revenue: peso(item.revenue),
    }))
}

function buildCashierPerformance(sales) {
  const cashierMap = new Map()

  sales.forEach((sale) => {
    const cashierName =
      String(sale.cashier_name || '').trim() || 'Unknown Cashier'
    const cashierKey = cashierName.toLowerCase()
    const existingCashier = cashierMap.get(cashierKey) || {
      id: `cashier-${cashierKey}`,
      cashier: cashierName,
      sales: 0,
      transactions: 0,
    }

    existingCashier.sales += Number(sale.total_amount || 0)
    existingCashier.transactions += 1
    cashierMap.set(cashierKey, existingCashier)
  })

  return Array.from(cashierMap.values())
    .sort((left, right) => right.sales - left.sales)
    .map((cashier) => ({
      ...cashier,
      sales: peso(cashier.sales),
    }))
}

function buildLowStockRows(inventoryItems) {
  return inventoryItems
    .filter((item) => isLowStock(item))
    .sort(
      (left, right) =>
        Number(left.stock_quantity) - Number(right.stock_quantity),
    )
    .map((item) => {
      const shortage = Number(item.reorder_level) - Number(item.stock_quantity)
      const status =
        Number(item.stock_quantity) <= Math.max(1, Number(item.reorder_level) / 2)
          ? 'Critical'
          : shortage > 0
            ? 'Reorder Soon'
            : 'Low Stock'

      return {
        id: item.id,
        item: item.product_name,
        stock: item.stock_quantity,
        reorderLevel: item.reorder_level,
        status,
      }
    })
}

function formatDateInput(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function addDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + Number(days || 0))
  return nextDate
}

function getSalesVelocityDateRange(referenceDate = new Date()) {
  const endDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )
  const startDate = addDays(endDate, -(SALES_VELOCITY_WINDOW_DAYS - 1))

  return {
    dateFrom: formatDateInput(startDate),
    dateTo: formatDateInput(endDate),
  }
}

function getSaleItemProductKey(item = {}) {
  const productId = item.product_id ?? item.productId ?? null

  if (productId != null) {
    return `product:${productId}`
  }

  return `name:${String(item.item_name || item.name || '').trim().toLowerCase()}`
}

function getInventoryProductKey(item = {}) {
  const productId = item.product_id ?? item.productId ?? item.id ?? null

  if (productId != null) {
    return `product:${productId}`
  }

  return `name:${String(item.product_name || item.product || '').trim().toLowerCase()}`
}

function getInventoryProductNameKey(item = {}) {
  return `name:${String(item.product_name || item.product || '').trim().toLowerCase()}`
}

function buildSalesVelocityMap(sales, windowDays = SALES_VELOCITY_WINDOW_DAYS) {
  const velocityMap = new Map()

  sales.forEach((sale) => {
    ;(sale.items || [])
      .filter((item) => !isServiceFeeLineItem(item))
      .forEach((item) => {
        const itemKey = getSaleItemProductKey(item)

        if (!itemKey || itemKey === 'name:') {
          return
        }

        const existingItem = velocityMap.get(itemKey) || {
          id: itemKey,
          item: String(item.item_name || item.name || 'Unknown Item').trim() || 'Unknown Item',
          sold: 0,
          revenue: 0,
        }

        existingItem.sold += Number(item.quantity || 0)
        existingItem.revenue += Number(item.line_total || 0)
        velocityMap.set(itemKey, existingItem)
      })
  })

  velocityMap.forEach((item) => {
    item.averageDailySales = Number(item.sold || 0) / windowDays
  })

  return velocityMap
}

function buildSalesVelocityRows(velocityMap) {
  return Array.from(velocityMap.values())
    .sort((left, right) => right.sold - left.sold)
    .map((item) => ({
      ...item,
      averageDailySales: item.averageDailySales.toFixed(2),
      revenue: peso(item.revenue),
    }))
}

function formatDaysLeft(days) {
  if (days < 0) {
    const expiredDays = Math.abs(days)
    return `${expiredDays} day${expiredDays === 1 ? '' : 's'} expired`
  }

  if (days === 0) {
    return 'Today'
  }

  return `${days} day${days === 1 ? '' : 's'}`
}

function buildPredictiveStockoutAlerts(inventoryItems, velocityMap) {
  const today = new Date()

  return inventoryItems
    .map((item) => {
      const velocity =
        velocityMap.get(getInventoryProductKey(item)) ||
        velocityMap.get(getInventoryProductNameKey(item))
      const averageDailySales = Number(velocity?.averageDailySales || 0)

      if (averageDailySales <= 0) {
        return null
      }

      const currentStock = Math.max(0, Number(item.stock_quantity || 0))
      const estimatedDaysBeforeStockout = currentStock / averageDailySales
      const roundedDaysBeforeStockout = Math.ceil(estimatedDaysBeforeStockout)
      const estimatedStockoutDate = formatDateInput(
        addDays(today, roundedDaysBeforeStockout),
      )
      const isBelowReorderLevel =
        currentStock <= Number(item.reorder_level || 0)

      if (
        roundedDaysBeforeStockout > STOCKOUT_ALERT_DAYS &&
        !isBelowReorderLevel
      ) {
        return null
      }

      return {
        id: `stockout-${item.product_id ?? item.id}`,
        item: item.product_name,
        stock: currentStock,
        averageDailySales: averageDailySales.toFixed(2),
        estimatedDaysBeforeStockout: formatDaysLeft(roundedDaysBeforeStockout),
        estimatedStockoutDate: shortDate(estimatedStockoutDate),
        status:
          currentStock === 0
            ? 'Out of Stock'
            : roundedDaysBeforeStockout <= 7
              ? 'Critical'
              : isBelowReorderLevel
                ? 'Reorder'
                : 'Watch',
        days_before_stockout: roundedDaysBeforeStockout,
      }
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        left.days_before_stockout - right.days_before_stockout ||
        Number(left.stock) - Number(right.stock),
    )
}

function buildNearExpiryAlerts(inventoryItems) {
  const rows = []

  inventoryItems.forEach((item) => {
    const availableBatches = Array.isArray(item.batches)
      ? item.batches.filter(
          (batch) =>
            Number(batch.quantity_on_hand || 0) > 0 &&
            String(batch.expiration_date || '').trim() !== '',
        )
      : []

    if (availableBatches.length > 0) {
      availableBatches.forEach((batch) => {
        const daysToExpiry = Number(batch.days_to_expiry)

        if (
          !Number.isFinite(daysToExpiry) ||
          daysToExpiry > NEAR_EXPIRY_ALERT_DAYS
        ) {
          return
        }

        rows.push({
          id: `expiry-${item.product_id ?? item.id}-${batch.id}`,
          item: item.product_name,
          batch: batch.batch_code || `Batch ${batch.id}`,
          expiryDate: shortDate(batch.expiration_date),
          daysToExpiry: formatDaysLeft(daysToExpiry),
          stock: batch.quantity_on_hand,
          status:
            daysToExpiry < 0
              ? 'Expired'
              : daysToExpiry <= 7
                ? 'Critical'
                : 'Near Expiry',
          days_to_expiry: daysToExpiry,
        })
      })

      return
    }

    const fallbackDaysToExpiry = Number(item.days_to_expiry)

    if (
      Number.isFinite(fallbackDaysToExpiry) &&
      fallbackDaysToExpiry <= NEAR_EXPIRY_ALERT_DAYS &&
      Number(item.stock_quantity || 0) > 0
    ) {
      rows.push({
        id: `expiry-${item.product_id ?? item.id}`,
        item: item.product_name,
        batch: 'Product date',
        expiryDate: shortDate(item.expiration_date || item.expiry_date),
        daysToExpiry: formatDaysLeft(fallbackDaysToExpiry),
        stock: item.stock_quantity,
        status:
          fallbackDaysToExpiry < 0
            ? 'Expired'
            : fallbackDaysToExpiry <= 7
              ? 'Critical'
              : 'Near Expiry',
        days_to_expiry: fallbackDaysToExpiry,
      })
    }
  })

  return rows.sort(
    (left, right) =>
      left.days_to_expiry - right.days_to_expiry ||
      Number(left.stock) - Number(right.stock),
  )
}

export async function getReportSnapshot(options = {}) {
  const cachedSnapshot = getCachedReportSnapshot(options)

  if (cachedSnapshot) {
    return cachedSnapshot
  }

  const inventoryResponse = await getInventoryItems({
    branchId: options.branchId,
  })
  const inventorySnapshot = inventoryResponse.items || inventoryResponse
  const lowStockRows = buildLowStockRows(inventorySnapshot)
  const salesHistory = await getSalesRecords(options)
  const velocityDateRange = getSalesVelocityDateRange()
  const salesVelocityHistory = await getSalesRecords({
    branchId: options.branchId,
    dateFrom: velocityDateRange.dateFrom,
    dateTo: velocityDateRange.dateTo,
  })
  const saleSummary = summarizeSales(salesHistory)
  const salesVelocityMap = buildSalesVelocityMap(salesVelocityHistory)
  const predictiveStockoutRows = buildPredictiveStockoutAlerts(
    inventorySnapshot,
    salesVelocityMap,
  )
  const nearExpiryRows = buildNearExpiryAlerts(inventorySnapshot)

  return setCachedResource(getReportCacheKey(options), {
    summary: {
      total_sales: saleSummary.totalSales,
      transaction_count: saleSummary.transactionCount,
      items_sold: saleSummary.itemsSold,
      low_stock_count: lowStockRows.length,
      predictive_stockout_count: predictiveStockoutRows.length,
      near_expiry_count: nearExpiryRows.length,
    },
    topItems: buildTopItems(salesHistory),
    lowStock: lowStockRows,
    salesVelocity: buildSalesVelocityRows(salesVelocityMap),
    predictiveStockout: predictiveStockoutRows,
    nearExpiry: nearExpiryRows,
    salesVelocityWindowDays: SALES_VELOCITY_WINDOW_DAYS,
    cashierPerformance: buildCashierPerformance(salesHistory),
  })
}
