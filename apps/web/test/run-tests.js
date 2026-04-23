import assert from 'node:assert/strict'
import { resolveInventoryRecordIds } from '../src/shared/utils/inventoryRecords.js'
import { deriveProductSellability } from '../src/shared/utils/productAvailability.js'
import { getDefaultReportDateRange } from '../src/shared/utils/reporting.js'
import {
  isSessionConflictError,
  isSessionConflictMessage,
} from '../src/features/auth/services/sessionLockService.js'
import {
  buildServiceFeeLineItems,
  isServiceFeeLineItem,
} from '../src/features/pos/utils/serviceFees.js'
import {
  INVENTORY_CATEGORY_UNCATEGORIZED,
  INVENTORY_FILTER_EXPIRY_DATE,
  INVENTORY_FILTER_LOW_STOCK,
  getInventoryCategoryOptions,
  getInventoryCategoryValue,
  resolveInventoryFilterResults,
} from '../src/features/inventory/utils/inventoryFilters.js'
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
