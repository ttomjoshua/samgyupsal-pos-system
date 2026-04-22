import api from '../../../shared/api/apiClient.js'
import {
  applySaleToInventory,
} from '../../inventory/services/inventoryService.js'
import {
  createSupabaseServiceError,
  getSupabaseClient,
  isSupabaseDataEnabled,
  supabaseRuntime,
  supabaseTables,
} from '../../../shared/api/supabaseClient.js'
import { getStoredSalesHistory, saveStoredSalesHistory } from '../../../shared/utils/storage.js'
import {
  SERVICE_FEE_PREFIX,
  buildServiceFeeLineItems,
  isServiceFeeLineItem,
  serviceFeeOptions,
} from '../utils/serviceFees.js'

export const paymentMethods = [{ value: 'cash', label: 'Cash' }]
export {
  SERVICE_FEE_PREFIX,
  buildServiceFeeLineItems,
  isServiceFeeLineItem,
  serviceFeeOptions,
}

function buildLocalSaleRecord(payload, meta = {}) {
  const submittedAt = new Date().toISOString()
  const normalizedItems = Array.isArray(meta.items)
    ? meta.items.map((item, index) => ({
        id: `${payload.cashier_id || 'cashier'}-${submittedAt}-${index + 1}`,
        product_id: item.product_id ?? null,
        item_name: item.item_name || 'Unknown Item',
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        line_total:
          Number(item.line_total || 0) ||
          Number(item.quantity || 0) * Number(item.unit_price || 0),
        is_service_fee: Boolean(item.is_service_fee),
      }))
    : []

  return {
    id: `sale-${submittedAt}-${payload.cashier_id || 'cashier'}`,
    cashier_id: payload.cashier_id,
    cashier_name: meta.cashierName || 'Unknown Cashier',
    branch_id: meta.branchId ?? null,
    branch_name: meta.branchName || 'All Branches',
    payment_method: payload.payment_method || 'cash',
    subtotal: Number(payload.subtotal || 0),
    discount: Number(payload.discount || 0),
    total_amount: Number(payload.total_amount || 0),
    cash_received: Number(payload.cash_received || 0),
    change_amount: Number(payload.change_amount || 0),
    submitted_at: submittedAt,
    items: normalizedItems,
  }
}

function persistLocalSaleRecord(record) {
  const salesHistory = getStoredSalesHistory()
  saveStoredSalesHistory([record, ...salesHistory])
}

async function syncSaleToInventory(record) {
  try {
    await applySaleToInventory(record.items, { branchId: record.branch_id })
    return true
  } catch (error) {
    console.error('Failed to sync the sale into inventory state:', error)
    return false
  }
}

async function createSupabaseSale(localRecord, payload) {
  const supabase = getSupabaseClient()
  const saleInsert = {
    cashier_id: localRecord.cashier_id,
    cashier_name: localRecord.cashier_name,
    branch_id: localRecord.branch_id,
    branch_name: localRecord.branch_name,
    payment_method: localRecord.payment_method,
    subtotal: localRecord.subtotal,
    discount: localRecord.discount,
    total_amount: localRecord.total_amount,
    cash_received: localRecord.cash_received,
    change_amount: localRecord.change_amount,
    submitted_at: localRecord.submitted_at,
  }

  const { data: saleRow, error: saleError } = await supabase
    .from(supabaseTables.sales)
    .insert(saleInsert)
    .select()
    .single()

  if (saleError) {
    throw createSupabaseServiceError(
      saleError,
      'Unable to record the sale in Supabase.',
    )
  }

  const normalizedSaleId = saleRow?.id ?? saleRow?.sale_id ?? null

  if (localRecord.items.length > 0 && normalizedSaleId != null) {
    const saleItemsInsert = localRecord.items.map((item) => ({
      sale_id: normalizedSaleId,
      product_id: item.product_id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
    }))

    const { error: saleItemsError } = await supabase
      .from(supabaseTables.saleItems)
      .insert(saleItemsInsert)

    if (saleItemsError) {
      try {
        await supabase.from(supabaseTables.sales).delete().eq('id', normalizedSaleId)
      } catch (cleanupError) {
        console.error('Failed to clean up partial sale record:', cleanupError)
      }

      throw createSupabaseServiceError(
        saleItemsError,
        'Sale items could not be recorded in Supabase.',
      )
    }
  }

  const inventorySynced = supabaseRuntime.inventoryManagedOnSale
    ? await syncSaleToInventory(localRecord)
    : false

  return {
    ok: true,
    source: 'supabase',
    paymentMethod: payload.payment_method || 'cash',
    total: payload.total_amount,
    submittedAt: localRecord.submitted_at,
    localRecord,
    sale: saleRow,
    inventorySynced,
  }
}

export async function createSale(payload, meta = {}) {
  const localRecord = buildLocalSaleRecord(payload, meta)

  if (isSupabaseDataEnabled) {
    return createSupabaseSale(localRecord, payload)
  }

  try {
    const response = await api.post('/sales', payload)
    persistLocalSaleRecord(localRecord)
    const inventorySynced = await syncSaleToInventory(localRecord)
    return {
      ...response.data,
      localRecord,
      inventorySynced,
    }
  } catch (error) {
    console.error('Failed to submit checkout to the API service:', error)
    persistLocalSaleRecord(localRecord)
    const inventorySynced = await syncSaleToInventory(localRecord)

    return {
      ok: true,
      source: 'local-fallback',
      paymentMethod: 'cash',
      total: payload.total_amount,
      submittedAt: localRecord.submitted_at,
      localRecord,
      inventorySynced,
    }
  }
}

export async function finalizeCashSale(payload) {
  return createSale(payload)
}
