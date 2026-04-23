import {
  cashierSales,
  topSellingItems,
} from '../../../shared/mocks/mockData'
import { getInventoryItems, isLowStock } from '../../inventory/services/inventoryService'
import { isServiceFeeLineItem } from '../../pos/utils/serviceFees'
import { getSalesRecords } from '../../pos/services/salesService'
import { getDefaultReportDateRange } from '../../../shared/utils/reporting.js'
import { isSupabaseDataEnabled } from '../../../shared/api/supabaseClient'
import { peso } from '../../../shared/utils/formatters'
import {
  getCachedResource,
  setCachedResource,
} from '../../../shared/utils/resourceCache'

const REPORTS_CACHE_PREFIX = 'reports:'
const REPORTS_CACHE_TTL_MS = 60 * 1000

function parseCurrencyValue(value) {
  return Number(String(value || '').replace(/[^\d.-]/g, '')) || 0
}

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

function buildTopItems(baseItems, sales) {
  const itemMap = new Map(
    baseItems.map((item) => [
      String(item.item || '').toLowerCase(),
      {
        id: item.id,
        item: item.item,
        sold: Number(item.sold || 0),
        revenue: parseCurrencyValue(item.revenue),
      },
    ]),
  )

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

function buildCashierPerformance(baseCashiers, sales) {
  const cashierMap = new Map(
    baseCashiers.map((cashier) => [
      String(cashier.cashier || '').toLowerCase(),
      {
        id: cashier.id,
        cashier: cashier.cashier,
        sales: parseCurrencyValue(cashier.sales),
        transactions: Number(cashier.transactions || 0),
      },
    ]),
  )

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
  const hasDateRange = Boolean(options.dateFrom || options.dateTo)

  if (isSupabaseDataEnabled) {
    const salesHistory = await getSalesRecords(options)
    const saleSummary = summarizeSales(salesHistory)

    return setCachedResource(getReportCacheKey(options), {
      summary: {
        total_sales: saleSummary.totalSales,
        transaction_count: saleSummary.transactionCount,
        items_sold: saleSummary.itemsSold,
        low_stock_count: lowStockRows.length,
      },
      topItems: buildTopItems([], salesHistory),
      lowStock: lowStockRows,
      cashierPerformance: buildCashierPerformance([], salesHistory),
    })
  }

  const salesHistory = await getSalesRecords(options)
  const saleSummary = summarizeSales(salesHistory)
  const useSeededFallback = !hasDateRange
  const fallbackTotalSales = useSeededFallback ? 312440 : 0
  const fallbackTransactionCount = useSeededFallback ? 29 : 0
  const fallbackItemsSold = useSeededFallback ? 165 : 0

  return setCachedResource(getReportCacheKey(options), {
    summary: {
      total_sales: fallbackTotalSales + saleSummary.totalSales,
      transaction_count: fallbackTransactionCount + saleSummary.transactionCount,
      items_sold: fallbackItemsSold + saleSummary.itemsSold,
      low_stock_count: lowStockRows.length,
    },
    topItems: buildTopItems(
      useSeededFallback ? topSellingItems : [],
      salesHistory,
    ),
    lowStock: lowStockRows,
    cashierPerformance: buildCashierPerformance(
      useSeededFallback ? cashierSales : [],
      salesHistory,
    ),
  })
}
