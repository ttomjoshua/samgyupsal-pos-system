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
    name: 'validateCheckout rejects non-positive unit prices',
    run() {
      const result = validateCheckout({
        paymentMethod: 'cash',
        amountReceived: 200,
        totalAmount: 120,
        subtotalAmount: 120,
        cartItems: [
          {
            name: 'Soju Original',
            quantity: 1,
            stockQuantity: 5,
            price: 0,
          },
        ],
      })

      assert.equal(result.isValid, false)
      assert.equal(
        result.errors.cart,
        'Soju Original cannot be sold until it has a valid price.',
      )
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
    name: 'deriveProductSellability flags zero-priced products as unavailable',
    run() {
      const result = deriveProductSellability({
        price: 0,
        stockQuantity: 8,
        is_active: true,
      })

      assert.deepEqual(result, {
        isSellable: false,
        availabilityReason: 'Price not set',
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
