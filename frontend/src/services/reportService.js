import {
  cashierSales,
  topSellingItems,
} from '../mockData'
import { getInventoryItems, isLowStock } from './inventoryService'
import {
  createSupabaseServiceError,
  getSupabaseClient,
  isSupabaseConfigured,
  supabaseTables,
} from './supabaseClient'
import { peso } from '../utils/formatters'
import { getStoredSalesHistory } from '../utils/storage'

function parseCurrencyValue(value) {
  return Number(String(value || '').replace(/[^\d.-]/g, '')) || 0
}

function summarizeSales(sales) {
  return sales.reduce(
    (summary, sale) => {
      summary.totalSales += Number(sale.total_amount || 0)
      summary.transactionCount += 1
      summary.itemsSold += (sale.items || []).reduce(
        (count, item) => count + Number(item.quantity || 0),
        0,
      )
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
    ;(sale.items || []).forEach((item) => {
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

export async function getReportSnapshot() {
  const inventoryResponse = await getInventoryItems()
  const inventorySnapshot = inventoryResponse.items || inventoryResponse
  const lowStockRows = buildLowStockRows(inventorySnapshot)

  if (isSupabaseConfigured) {
    const salesHistory = await getSupabaseSalesHistory()
    const saleSummary = summarizeSales(salesHistory)

    return {
      summary: {
        total_sales: saleSummary.totalSales,
        transaction_count: saleSummary.transactionCount,
        items_sold: saleSummary.itemsSold,
        low_stock_count: lowStockRows.length,
      },
      topItems: buildTopItems([], salesHistory),
      lowStock: lowStockRows,
      cashierPerformance: buildCashierPerformance([], salesHistory),
    }
  }

  const storedSales = getStoredSalesHistory()
  const saleSummary = summarizeSales(storedSales)

  return {
    summary: {
      total_sales: 312440 + saleSummary.totalSales,
      transaction_count: 29 + saleSummary.transactionCount,
      items_sold: 165 + saleSummary.itemsSold,
      low_stock_count: lowStockRows.length,
    },
    topItems: buildTopItems(topSellingItems, storedSales),
    lowStock: lowStockRows,
    cashierPerformance: buildCashierPerformance(cashierSales, storedSales),
  }
}
