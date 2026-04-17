import assert from 'node:assert/strict'
import { resolveInventoryRecordIds } from '../src/shared/utils/inventoryRecords.js'
import { getDefaultReportDateRange } from '../src/shared/utils/reporting.js'
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
