import assert from 'node:assert/strict'
import { resolveInventoryRecordIds } from '../src/shared/utils/inventoryRecords.js'
import { deriveProductSellability } from '../src/shared/utils/productAvailability.js'
import { getDefaultReportDateRange } from '../src/shared/utils/reporting.js'
import {
  clearCachedResourceByPrefix,
  getCachedResource,
  setCachedResource,
} from '../src/shared/utils/resourceCache.js'
import {
  DEFAULT_ADMIN_IDLE_TIMEOUT_MS,
  DEFAULT_EMPLOYEE_IDLE_TIMEOUT_MS,
  getActivityStorageKey,
  getConfiguredIdleTimeouts,
  getIdleTimeoutMs,
  getInactivityLogoutMessage,
  parseActivityTimestamp,
} from '../src/features/auth/utils/inactivity.js'
import {
  isSessionConflictError,
  isSessionConflictMessage,
} from '../src/features/auth/services/sessionLockService.js'
import {
  buildServiceFeeLineItems,
  isServiceFeeLineItem,
} from '../src/features/pos/utils/serviceFees.js'
import {
  buildReceiptDocumentHtml,
  getReceiptFilename,
} from '../src/features/pos/utils/receiptActions.js'
import {
  buildReceiptPreviewData,
  filterSalesRecords,
  getSaleReference,
} from '../src/features/pos/services/salesService.js'
import {
  INVENTORY_ALLOWED_CATEGORIES,
  INVENTORY_CATEGORY_UNCATEGORIZED,
  INVENTORY_FILTER_EXPIRY_DATE,
  INVENTORY_FILTER_LOW_STOCK,
  getInventoryCategoryLabel,
  getInventoryCategoryOptions,
  getInventoryCategoryValue,
  resolveInventoryFilterResults,
} from '../src/features/inventory/utils/inventoryFilters.js'
import { normalizeInventoryItem } from '../src/features/inventory/services/inventoryService.js'
import {
  validateCheckout,
  validateInventoryForm,
  validateInventoryQuantityAction,
} from '../src/shared/utils/validation.js'

const tests = [
  {
    name: 'validateCheckout rejects overselling past available stock',
    run() {
      const result = validateCheckout({
        paymentMethod: 'cash',
        amountReceived: 500,
        totalAmount: 300,
        subtotalAmount: 300,
        cartItems: [
          {
            name: 'Samgyupsal Set A',
            quantity: 3,
            stockQuantity: 2,
            price: 100,
          },
        ],
      })

      assert.equal(result.isValid, false)
      assert.equal(
        result.errors.cart,
        'Samgyupsal Set A only has 2 items in stock.',
      )
    },
  },
  {
    name: 'validateInventoryForm requires whole-number stock values',
    run() {
      const result = validateInventoryForm({
        product_name: 'Kimchi',
        category_name: 'Retail',
        price: '120',
        stock_quantity: '1.5',
        unit: 'pack',
        expiry_date: '2026-04-30',
        reorder_level: '2.2',
      })

      assert.equal(result.isValid, false)
      assert.equal(result.errors.stock, 'Stock quantity must be a whole number.')
    },
  },
  {
    name: 'validateInventoryForm canonicalizes allowed inventory category labels',
    run() {
      const result = validateInventoryForm({
        product_name: 'Seaweed Snack',
        category_name: '  seaWEED ',
        price: '55',
        stock_quantity: '10',
        unit: 'pack',
        expiry_date: '2026-05-20',
        reorder_level: '2',
      })

      assert.equal(result.isValid, true)
      assert.equal(result.sanitizedData.category_name, 'Seaweed')
    },
  },
  {
    name: 'validateInventoryQuantityAction rejects decimal adjustments',
    run() {
      const result = validateInventoryQuantityAction({
        selectedItem: {
          stock_quantity: 10,
        },
        quantityValue: '1.5',
        mode: 'stock-in',
      })

      assert.equal(result.isValid, false)
      assert.equal(
        result.errors.quantity,
        'Enter a whole number stock quantity to continue.',
      )
    },
  },
  {
    name: 'validateInventoryQuantityAction allows zero as the final stock count',
    run() {
      const result = validateInventoryQuantityAction({
        selectedItem: {
          stock_quantity: 10,
        },
        quantityValue: '0',
        mode: 'adjust-stock',
      })

      assert.equal(result.isValid, true)
      assert.equal(result.sanitizedAmount, 0)
    },
  },
  {
    name: 'validateCheckout allows zero-priced items in cash sales',
    run() {
      const result = validateCheckout({
        paymentMethod: 'cash',
        amountReceived: 0,
        totalAmount: 0,
        subtotalAmount: 0,
        cartItems: [
          {
            name: 'Soju Original',
            quantity: 1,
            stockQuantity: 5,
            price: 0,
          },
        ],
      })

      assert.equal(result.isValid, true)
      assert.deepEqual(result.errors, {})
    },
  },
  {
    name: 'validateCheckout allows zero-total cash sales without amount received',
    run() {
      const result = validateCheckout({
        paymentMethod: 'cash',
        amountReceived: '',
        totalAmount: 0,
        subtotalAmount: 0,
        cartItems: [
          {
            name: 'Promo Samgyup Add-on',
            quantity: 1,
            stockQuantity: 5,
            price: 0,
          },
        ],
      })

      assert.equal(result.isValid, true)
      assert.deepEqual(result.errors, {})
    },
  },
  {
    name: 'getDefaultReportDateRange returns a rolling 14-day window',
    run() {
      const result = getDefaultReportDateRange(new Date('2026-04-17T09:30:00Z'))

      assert.deepEqual(result, {
        dateFrom: '2026-04-04',
        dateTo: '2026-04-17',
      })
    },
  },
  {
    name: 'resolveInventoryRecordIds keeps product and inventory identifiers distinct',
    run() {
      const result = resolveInventoryRecordIds({
        id: 41,
        inventory_item_id: 41,
        product_id: 12,
      })

      assert.deepEqual(result, {
        inventoryItemId: 41,
        productId: 12,
      })
    },
  },
  {
    name: 'deriveProductSellability keeps zero-priced products sellable for checkout',
    run() {
      const result = deriveProductSellability({
        price: 0,
        stockQuantity: 8,
        is_active: true,
      })

      assert.deepEqual(result, {
        isSellable: true,
        availabilityReason: 'Price not set',
        hasPriceConfigured: false,
      })
    },
  },
  {
    name: 'resource cache stores values and clears by prefix',
    run() {
      setCachedResource('test:navigation:one', { count: 1 })
      setCachedResource('test:navigation:two', { count: 2 })

      assert.equal(getCachedResource('test:navigation:one').count, 1)
      assert.equal(getCachedResource('test:navigation:two').count, 2)

      clearCachedResourceByPrefix('test:navigation:')

      assert.equal(getCachedResource('test:navigation:one'), null)
      assert.equal(getCachedResource('test:navigation:two'), null)
    },
  },
  {
    name: 'role-based inactivity timeouts resolve to production defaults',
    run() {
      const configuredTimeouts = getConfiguredIdleTimeouts()

      assert.equal(configuredTimeouts.admin, DEFAULT_ADMIN_IDLE_TIMEOUT_MS)
      assert.equal(configuredTimeouts.employee, DEFAULT_EMPLOYEE_IDLE_TIMEOUT_MS)
      assert.equal(
        getIdleTimeoutMs({ id: 1, roleKey: 'admin' }),
        DEFAULT_ADMIN_IDLE_TIMEOUT_MS,
      )
      assert.equal(
        getIdleTimeoutMs({ id: 2, roleKey: 'employee' }),
        DEFAULT_EMPLOYEE_IDLE_TIMEOUT_MS,
      )
    },
  },
  {
    name: 'inactivity activity keys are scoped per authenticated account',
    run() {
      assert.equal(
        getActivityStorageKey({ id: 1, roleKey: 'admin' }),
        'samgyupsal:last-activity-at:admin:1',
      )
      assert.equal(
        getActivityStorageKey({ id: 2, roleKey: 'employee' }),
        'samgyupsal:last-activity-at:employee:2',
      )
      assert.equal(
        getInactivityLogoutMessage({ id: 1, roleKey: 'admin' }).includes('15 minutes'),
        true,
      )
      assert.equal(
        getInactivityLogoutMessage({ id: 2, roleKey: 'employee' }).includes('30 minutes'),
        true,
      )
      assert.equal(parseActivityTimestamp('12345'), 12345)
      assert.equal(parseActivityTimestamp('invalid'), null)
    },
  },
  {
    name: 'isSessionConflictMessage accepts equivalent mobile and desktop conflict wording',
    run() {
      assert.equal(
        isSessionConflictMessage(
          'This account is already active on another device.',
        ),
        true,
      )
    },
  },
  {
    name: 'isSessionConflictError recognizes semantic session conflict errors',
    run() {
      assert.equal(
        isSessionConflictError({
          message: 'Account already in use on another device.',
        }),
        true,
      )
    },
  },
  {
    name: 'isSessionConflictError recognizes nested Supabase RPC conflict messages',
    run() {
      assert.equal(
        isSessionConflictError({
          details: 'Active session already exists for this account.',
        }),
        true,
      )
    },
  },
  {
    name: 'isSessionConflictError recognizes wrapped conflict causes',
    run() {
      assert.equal(
        isSessionConflictError({
          cause: {
            message: 'This account is already signed in elsewhere.',
          },
        }),
        true,
      )
    },
  },
  {
    name: 'buildServiceFeeLineItems creates checkout add-on rows with receipt-safe names',
    run() {
      const result = buildServiceFeeLineItems([
        'self_service_cooking',
        'microwave_usage',
      ])

      assert.equal(result.length, 2)
      assert.equal(result[0].item_name, 'Service Fee - Self-Service Cooking')
      assert.equal(result[0].line_total, 10)
      assert.equal(result[1].item_name, 'Service Fee - Microwave Usage')
      assert.equal(result[1].line_total, 5)
    },
  },
  {
    name: 'isServiceFeeLineItem recognizes stored service-fee sale lines',
    run() {
      assert.equal(
        isServiceFeeLineItem({
          item_name: 'Service Fee - Microwave Usage',
        }),
        true,
      )
    },
  },
  {
    name: 'filterSalesRecords preserves employee sales scope in local history mode',
    run() {
      const result = filterSalesRecords(
        [
          {
            id: 1,
            cashier_id: 'employee-1',
            cashier_name: 'Cashier One',
            branch_id: 1,
            branch_name: 'Sta. Lucia',
            payment_method: 'cash',
            subtotal: 200,
            discount: 0,
            total_amount: 200,
            submitted_at: '2026-04-20T09:00:00.000Z',
            items: [{ item_name: 'Set A', quantity: 2, unit_price: 100, line_total: 200 }],
          },
          {
            id: 2,
            cashier_id: 'employee-2',
            cashier_name: 'Cashier Two',
            branch_id: 1,
            branch_name: 'Sta. Lucia',
            payment_method: 'cash',
            subtotal: 150,
            discount: 0,
            total_amount: 150,
            submitted_at: '2026-04-21T09:00:00.000Z',
            items: [{ item_name: 'Set B', quantity: 1, unit_price: 150, line_total: 150 }],
          },
        ],
        {
          user: {
            id: 'employee-1',
            roleKey: 'employee',
          },
        },
      )

      assert.equal(result.length, 1)
      assert.equal(result[0].cashier_id, 'employee-1')
    },
  },
  {
    name: 'filterSalesRecords supports admin transaction and cashier filtering',
    run() {
      const result = filterSalesRecords(
        [
          {
            id: 12,
            cashier_id: 'employee-1',
            cashier_name: 'Cashier One',
            branch_id: 1,
            branch_name: 'Sta. Lucia',
            payment_method: 'cash',
            subtotal: 300,
            discount: 20,
            total_amount: 280,
            submitted_at: '2026-04-22T11:30:00.000Z',
            items: [{ item_name: 'Set A', quantity: 3, unit_price: 100, line_total: 300 }],
          },
          {
            id: 44,
            cashier_id: 'employee-2',
            cashier_name: 'Cashier Two',
            branch_id: 2,
            branch_name: 'Dollar',
            payment_method: 'cash',
            subtotal: 180,
            discount: 0,
            total_amount: 180,
            submitted_at: '2026-04-21T11:30:00.000Z',
            items: [{ item_name: 'Set B', quantity: 2, unit_price: 90, line_total: 180 }],
          },
        ],
        {
          user: {
            id: 'admin-1',
            roleKey: 'admin',
          },
          cashierQuery: 'cashier one',
          transactionQuery: 'TRX-000012',
        },
      )

      assert.equal(result.length, 1)
      assert.equal(result[0].id, 12)
      assert.equal(getSaleReference(result[0]), 'TRX-000012')
    },
  },
  {
    name: 'buildReceiptPreviewData rolls up service fees and discount labels for history details',
    run() {
      const result = buildReceiptPreviewData({
        id: 7,
        discount_type: 'pwd',
        cashier_name: 'Cashier One',
        branch_name: 'Sta. Lucia',
        payment_method: 'cash',
        subtotal: 250,
        discount: 50,
        total_amount: 205,
        cash_received: 500,
        change_amount: 295,
        submitted_at: '2026-04-23T10:00:00.000Z',
        items: [
          {
            item_name: 'Samgyupsal Set',
            quantity: 2,
            unit_price: 100,
            line_total: 200,
          },
          {
            item_name: 'Service Fee - Microwave Usage',
            quantity: 1,
            unit_price: 5,
            line_total: 5,
          },
        ],
      })

      assert.equal(result.transactionNumber, 'TRX-000007')
      assert.equal(result.serviceFeeTotal, 5)
      assert.equal(result.discountTypeLabel, 'PWD')
      assert.equal(result.notes, '')
      assert.equal(result.items.length, 2)
    },
  },
  {
    name: 'buildReceiptDocumentHtml creates a printable receipt document from preview data',
    run() {
      const receipt = buildReceiptPreviewData({
        id: 18,
        transaction_number: 'TRX-20260423-018',
        cashier_name: 'Cashier One',
        branch_name: 'Dollar',
        payment_method: 'cash',
        subtotal: 320,
        discount: 20,
        total_amount: 300,
        cash_received: 500,
        change_amount: 200,
        notes: 'Customer requested official printout.',
        submitted_at: '2026-04-23T12:45:00.000Z',
        items: [
          {
            item_name: 'Samgyupsal Set',
            quantity: 2,
            unit_price: 160,
            line_total: 320,
          },
        ],
      })

      const documentMarkup = buildReceiptDocumentHtml(receipt)

      assert.equal(getReceiptFilename(receipt), 'trx-20260423-018.html')
      assert.match(documentMarkup, /Sales Receipt/)
      assert.match(documentMarkup, /TRX-20260423-018/)
      assert.match(documentMarkup, /Customer requested official printout\./)
      assert.match(documentMarkup, /Samgyupsal Set/)
    },
  },
  {
    name: 'resolveInventoryFilterResults keeps branch, status, and category filters aligned',
    run() {
      const result = resolveInventoryFilterResults({
        items: [
          {
            id: 1,
            branch_id: 1,
            category_name: 'Frozen',
            product_name: 'Pork Belly',
            stock_quantity: 4,
            reorder_level: 10,
            expiry_date: '2026-05-01',
          },
          {
            id: 2,
            branch_id: 1,
            category_name: 'Frozen',
            product_name: 'Beef Bulgogi',
            stock_quantity: 18,
            reorder_level: 10,
            expiry_date: '2026-05-03',
          },
          {
            id: 3,
            branch_id: 2,
            category_name: 'Retail',
            product_name: 'Kimchi',
            stock_quantity: 3,
            reorder_level: 10,
            expiry_date: '2026-04-28',
          },
        ],
        branchId: '1',
        status: INVENTORY_FILTER_LOW_STOCK,
        category: 'Frozen',
      })

      assert.equal(result.branchItems.length, 2)
      assert.equal(result.filteredItems.length, 1)
      assert.equal(result.filteredItems[0].product_name, 'Pork Belly')
    },
  },
  {
    name: 'resolveInventoryFilterResults sorts expiry-date items and clears invalid categories',
    run() {
      const result = resolveInventoryFilterResults({
        items: [
          {
            id: 1,
            branch_id: 2,
            category_name: 'Beverages',
            product_name: 'Iced Tea',
            stock_quantity: 12,
            reorder_level: 10,
            expiry_date: '2026-05-04',
          },
          {
            id: 2,
            branch_id: 2,
            category_name: 'Retail',
            product_name: 'Kimchi',
            stock_quantity: 8,
            reorder_level: 10,
            expiry_date: '2026-04-27',
          },
          {
            id: 3,
            branch_id: 2,
            category_name: 'Retail',
            product_name: 'Lettuce',
            stock_quantity: 20,
            reorder_level: 10,
            expiry_date: '',
          },
        ],
        branchId: '2',
        status: INVENTORY_FILTER_EXPIRY_DATE,
        category: 'Frozen',
      })

      assert.equal(result.resolvedCategory, 'all')
      assert.deepEqual(
        result.filteredItems.map((item) => item.product_name),
        ['Kimchi', 'Iced Tea'],
      )
      assert.deepEqual(result.categoryOptions, ['Beverages', 'Retail'])
    },
  },
  {
    name: 'resolveInventoryFilterResults keeps branch-wide categories available under status filters',
    run() {
      const result = resolveInventoryFilterResults({
        items: [
          {
            id: 1,
            branch_id: 1,
            category_name: 'Frozen',
            product_name: 'Pork Belly',
            stock_quantity: 20,
            reorder_level: 10,
            expiry_date: '',
          },
          {
            id: 2,
            branch_id: 1,
            category_name: 'Retail',
            product_name: 'Kimchi',
            stock_quantity: 8,
            reorder_level: 10,
            expiry_date: '2026-05-04',
          },
        ],
        branchId: '1',
        status: INVENTORY_FILTER_EXPIRY_DATE,
        category: 'Frozen',
      })

      assert.equal(result.resolvedCategory, 'Frozen')
      assert.deepEqual(result.categoryOptions, ['Frozen', 'Retail'])
      assert.equal(result.filteredItems.length, 0)
    },
  },
  {
    name: 'getInventoryCategoryOptions includes uncategorized records for filtering',
    run() {
      const result = getInventoryCategoryOptions([
        { category_name: '' },
        { category_name: 'Beverages' },
        { category_name: null },
      ])

      assert.deepEqual(result, ['Beverages', INVENTORY_CATEGORY_UNCATEGORIZED])
    },
  },
  {
    name: 'getInventoryCategoryLabel canonicalizes allowed inventory categories',
    run() {
      assert.equal(getInventoryCategoryLabel(' korean noodles '), 'Korean Noodles')
      assert.equal(getInventoryCategoryLabel('SEAWEED'), 'Seaweed')
      assert.deepEqual(INVENTORY_ALLOWED_CATEGORIES, [
        'Korean Noodles',
        'Samgyup bowl meat',
        'Samgyup meat',
        'Seaweed',
      ])
    },
  },
  {
    name: 'getInventoryCategoryOptions dedupes normalized labels and keeps allowed labels canonical',
    run() {
      const result = getInventoryCategoryOptions([
        { category_name: ' korean noodles ' },
        { category_name: 'Korean Noodles' },
        { category_name: 'SEAWEED' },
        { category_name: 'Seaweed ' },
      ])

      assert.deepEqual(result, ['Korean Noodles', 'Seaweed'])
    },
  },
  {
    name: 'resolveInventoryFilterResults matches uncategorized items through category filtering',
    run() {
      const result = resolveInventoryFilterResults({
        items: [
          {
            id: 1,
            branch_id: 1,
            category_name: '',
            product_name: 'House Sauce',
            stock_quantity: 4,
            reorder_level: 10,
            expiry_date: '',
          },
          {
            id: 2,
            branch_id: 1,
            category_name: 'Retail',
            product_name: 'Kimchi',
            stock_quantity: 6,
            reorder_level: 10,
            expiry_date: '',
          },
        ],
        branchId: '1',
        category: INVENTORY_CATEGORY_UNCATEGORIZED,
      })

      assert.equal(result.resolvedCategory, INVENTORY_CATEGORY_UNCATEGORIZED)
      assert.deepEqual(
        result.filteredItems.map((item) => item.product_name),
        ['House Sauce'],
      )
    },
  },
  {
    name: 'inventory category fallback uses legacy category when category_name is blank',
    run() {
      const item = {
        category_name: '',
        category: 'Samgyup meat',
      }

      assert.equal(getInventoryCategoryValue(item), 'Samgyup meat')

      const result = resolveInventoryFilterResults({
        items: [
          {
            id: 1,
            branch_id: 1,
            category_name: '',
            category: 'Samgyup meat',
            product_name: 'Pork Belly',
            stock_quantity: 5,
            reorder_level: 10,
            expiry_date: '',
          },
        ],
        branchId: '1',
        category: 'Samgyup meat',
      })

      assert.deepEqual(result.categoryOptions, ['Samgyup meat'])
      assert.equal(result.resolvedCategory, 'Samgyup meat')
      assert.deepEqual(
        result.filteredItems.map((inventoryItem) => inventoryItem.product_name),
        ['Pork Belly'],
      )
    },
  },
  {
    name: 'inventory category fallback prefers legacy labels over uncategorized defaults',
    run() {
      const item = normalizeInventoryItem({
        category_name: 'Uncategorized',
        category: '  samgyup meat  ',
        product_name: 'Pork Belly Plain',
        stock_quantity: 9,
        reorder_level: 10,
        unit: '250g',
      })

      assert.equal(item.category_name, 'Samgyup meat')
    },
  },
  {
    name: 'resolveInventoryFilterResults canonicalizes allowed legacy categories during filtering',
    run() {
      const result = resolveInventoryFilterResults({
        items: [
          {
            id: 1,
            branch_id: 1,
            category_name: 'Uncategorized',
            category: '  korean noodles ',
            product_name: 'Buldak Carbo',
            stock_quantity: 25,
            reorder_level: 10,
            expiry_date: '',
          },
        ],
        branchId: '1',
        category: 'KOREAN NOODLES',
      })

      assert.deepEqual(result.categoryOptions, ['Korean Noodles'])
      assert.equal(result.resolvedCategory, 'Korean Noodles')
      assert.deepEqual(
        result.filteredItems.map((inventoryItem) => inventoryItem.product_name),
        ['Buldak Carbo'],
      )
    },
  },
  {
    name: 'resolveInventoryFilterResults matches categories using normalized text',
    run() {
      const result = resolveInventoryFilterResults({
        items: [
          {
            id: 1,
            branch_id: 1,
            category_name: 'Chocolate ',
            product_name: 'Choco Bar',
            stock_quantity: 12,
            reorder_level: 10,
            expiry_date: '',
          },
          {
            id: 2,
            branch_id: 1,
            category_name: 'Coffee',
            product_name: 'Iced Coffee',
            stock_quantity: 14,
            reorder_level: 10,
            expiry_date: '',
          },
        ],
        branchId: '1',
        category: 'Chocolate',
      })

      assert.equal(result.resolvedCategory, 'Chocolate')
      assert.deepEqual(
        result.filteredItems.map((item) => item.product_name),
        ['Choco Bar'],
      )
    },
  },
]

let failedTests = 0

for (const currentTest of tests) {
  try {
    currentTest.run()
    console.log(`PASS ${currentTest.name}`)
  } catch (error) {
    failedTests += 1
    console.error(`FAIL ${currentTest.name}`)
    console.error(error)
  }
}

if (failedTests > 0) {
  console.error(`\n${failedTests} test(s) failed.`)
  globalThis.process.exit(1)
}

console.log(`\n${tests.length} test(s) passed.`)
