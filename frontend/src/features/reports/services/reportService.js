import {
  cashierSales,
  topSellingItems,
} from '../../../shared/mocks/mockData'
import { getInventoryItems, isLowStock } from '../../inventory/services/inventoryService'
import { isServiceFeeLineItem } from '../../pos/utils/serviceFees'
import { getDefaultReportDateRange } from '../../../shared/utils/reporting.js'
import {
  createSupabaseServiceError,
  getSupabaseClient,
  isSupabaseDataEnabled,
  supabaseTables,
} from '../../../shared/api/supabaseClient'
import { peso } from '../../../shared/utils/formatters'
import { getStoredSalesHistory } from '../../../shared/utils/storage'

function parseCurrencyValue(value) {
  return Number(String(value || '').replace(/[^\d.-]/g, '')) || 0
}

export { getDefaultReportDateRange }

function toDateBoundary(value, boundary = 'start') {
  if (!value) {
    return null
  }

  const boundaryTime =
    boundary === 'end' ? 'T23:59:59.999' : 'T00:00:00.000'
  const parsedDate = new Date(`${value}${boundaryTime}`)

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function isSaleWithinDateRange(sale, options = {}) {
  const rangeStart = toDateBoundary(options.dateFrom, 'start')
  const rangeEnd = toDateBoundary(options.dateTo, 'end')

  if (!rangeStart && !rangeEnd) {
    return true
  }

  const submittedAt = new Date(sale.submitted_at || sale.created_at || '')

  if (Number.isNaN(submittedAt.getTime())) {
    return false
  }

  if (rangeStart && submittedAt < rangeStart) {
    return false
  }

  if (rangeEnd && submittedAt > rangeEnd) {
    return false
  }

  return true
}

function matchesSaleFilters(sale, options = {}) {
  if (!isSaleWithinDateRange(sale, options)) {
    return false
  }

  if (
    options.cashierId != null &&
    String(options.cashierId).trim() !== '' &&
    String(sale.cashier_id || '').trim() !== String(options.cashierId).trim()
  ) {
    return false
  }

  if (
    options.branchId != null &&
    String(options.branchId).trim() !== '' &&
    Number(sale.branch_id) !== Number(options.branchId)
  ) {
    return false
  }

  return true
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

async function getSupabaseSalesHistory() {
  const supabase = getSupabaseClient()
  const [{ data: salesRows, error: salesError }, { data: saleItemRows, error: saleItemsError }] =
    await Promise.all([
      supabase.from(supabaseTables.sales).select('*'),
      supabase.from(supabaseTables.saleItems).select('*'),
    ])

  if (salesError) {
    throw createSupabaseServiceError(
      salesError,
      'Sales records could not be loaded from Supabase.',
    )
  }

  if (saleItemsError) {
    throw createSupabaseServiceError(
      saleItemsError,
      'Sale item records could not be loaded from Supabase.',
    )
  }

  const saleMap = new Map(
    (salesRows || []).map((sale) => [
      String(sale.id ?? sale.sale_id),
      {
        ...sale,
        items: [],
      },
    ]),
  )

  ;(saleItemRows || []).forEach((item) => {
    const saleKey = String(item.sale_id)
    const matchedSale = saleMap.get(saleKey)

    if (!matchedSale) {
      return
    }

    matchedSale.items.push({
      ...item,
      line_total:
        Number(item.line_total || 0) ||
        Number(item.quantity || 0) * Number(item.unit_price || 0),
    })
  })

  return Array.from(saleMap.values())
}

export async function getReportSnapshot(options = {}) {
  const inventoryResponse = await getInventoryItems({
    branchId: options.branchId,
  })
  const inventorySnapshot = inventoryResponse.items || inventoryResponse
  const lowStockRows = buildLowStockRows(inventorySnapshot)
  const hasDateRange = Boolean(options.dateFrom || options.dateTo)

  if (isSupabaseDataEnabled) {
    const salesHistory = await getSupabaseSalesHistory()
    const filteredSalesHistory = salesHistory.filter((sale) => matchesSaleFilters(sale, options))
    const saleSummary = summarizeSales(filteredSalesHistory)

    return {
      summary: {
        total_sales: saleSummary.totalSales,
        transaction_count: saleSummary.transactionCount,
        items_sold: saleSummary.itemsSold,
        low_stock_count: lowStockRows.length,
      },
      topItems: buildTopItems([], filteredSalesHistory),
      lowStock: lowStockRows,
      cashierPerformance: buildCashierPerformance([], filteredSalesHistory),
    }
  }

  const storedSales = getStoredSalesHistory()
  const filteredStoredSales = storedSales.filter((sale) => matchesSaleFilters(sale, options))
  const saleSummary = summarizeSales(filteredStoredSales)
  const useSeededFallback = !hasDateRange
  const fallbackTotalSales = useSeededFallback ? 312440 : 0
  const fallbackTransactionCount = useSeededFallback ? 29 : 0
  const fallbackItemsSold = useSeededFallback ? 165 : 0

  return {
    summary: {
      total_sales: fallbackTotalSales + saleSummary.totalSales,
      transaction_count: fallbackTransactionCount + saleSummary.transactionCount,
      items_sold: fallbackItemsSold + saleSummary.itemsSold,
      low_stock_count: lowStockRows.length,
    },
    topItems: buildTopItems(
      useSeededFallback ? topSellingItems : [],
      filteredStoredSales,
    ),
    lowStock: lowStockRows,
    cashierPerformance: buildCashierPerformance(
      useSeededFallback ? cashierSales : [],
      filteredStoredSales,
    ),
  }
}
