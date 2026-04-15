export const products = [
  { id: 1, name: 'Samgyupsal Set A', price: 899, category: 'Meals' },
  { id: 2, name: 'Kimchi Fried Rice', price: 179, category: 'Meals' },
  { id: 3, name: 'Soju Original', price: 145, category: 'Drinks' },
  { id: 4, name: 'Melona Ice Cream', price: 85, category: 'Add-ons' },
  { id: 5, name: 'Korean Ramen Pack', price: 99, category: 'Retail Items' },
  { id: 6, name: 'Gochujang Sauce', price: 120, category: 'Ingredients' },
  { id: 7, name: 'Bulgogi Bowl', price: 249, category: 'Meals' },
  { id: 8, name: 'Iced Tea Pitcher', price: 110, category: 'Drinks' },
]

export const inventoryItems = [
  {
    id: 1,
    product: 'Kimchi',
    category: 'Retail',
    stock: 25,
    unit: 'pack',
    expiry: '2026-12-20',
  },
  {
    id: 2,
    product_id: 1,
    product: 'Samgyupsal Set A',
    category: 'Meals',
    stock: 8,
    unit: 'set',
    expiry: '2026-05-04',
  },
  {
    id: 3,
    product_id: 3,
    product: 'Soju Original',
    category: 'Drinks',
    stock: 40,
    unit: 'bottle',
    expiry: '2026-09-11',
  },
  {
    id: 4,
    product: 'Lettuce Pack',
    category: 'Ingredients',
    stock: 6,
    unit: 'bundle',
    expiry: '2026-04-19',
  },
  {
    id: 5,
    product: 'Cheese Dip',
    category: 'Add-ons',
    stock: 14,
    unit: 'cup',
    expiry: '2026-04-26',
  },
  {
    id: 6,
    product: 'Instant Ramen',
    category: 'Retail',
    stock: 62,
    unit: 'pack',
    expiry: '2027-02-28',
  },
]

export const reportSummaryCards = [
  { id: 1, label: 'Daily Sales Total', value: 'PHP 12,480.00', note: 'Transactions recorded today' },
  { id: 2, label: 'Weekly Sales Total', value: 'PHP 74,915.00', note: 'Current seven-day sales value' },
  { id: 3, label: 'Monthly Sales Total', value: 'PHP 312,440.00', note: 'Running total for this month' },
]

export const topSellingItems = [
  { id: 1, item: 'Samgyupsal Set A', sold: 68, revenue: 'PHP 61,132.00' },
  { id: 2, item: 'Kimchi Fried Rice', sold: 54, revenue: 'PHP 9,666.00' },
  { id: 3, item: 'Soju Original', sold: 43, revenue: 'PHP 6,235.00' },
]

export const lowStockItems = [
  { id: 1, item: 'Lettuce Pack', stock: 6, reorderLevel: 12, status: 'Reorder Soon' },
  { id: 2, item: 'Cheese Dip', stock: 4, reorderLevel: 10, status: 'Critical' },
  { id: 3, item: 'Melona Ice Cream', stock: 9, reorderLevel: 15, status: 'Low Stock' },
]

export const cashierSales = [
  { id: 1, cashier: 'Admin User', sales: 'PHP 8,120.00', transactions: 17 },
  { id: 2, cashier: 'Cashier 1', sales: 'PHP 2,940.00', transactions: 8 },
  { id: 3, cashier: 'Cashier 2', sales: 'PHP 1,420.00', transactions: 4 },
]
