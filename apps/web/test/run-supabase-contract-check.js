import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')
const envFilePath = path.join(appRoot, '.env')

const defaultContracts = {
  tables: {
    products: 'products',
    sales: 'sales',
    saleItems: 'sale_items',
    branches: 'branches',
    profiles: 'profiles',
  },
  views: {
    productCatalog: 'product_catalog_view',
    inventoryCatalog: 'inventory_catalog_view',
  },
}

function loadEnvFile(filepath) {
  if (!fs.existsSync(filepath)) {
    return {}
  }

  return fs
    .readFileSync(filepath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmedLine = String(line || '').trim()

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        return env
      }

      const separatorIndex = trimmedLine.indexOf('=')

      if (separatorIndex === -1) {
        return env
      }

      const key = trimmedLine.slice(0, separatorIndex).trim()
      const rawValue = trimmedLine.slice(separatorIndex + 1).trim()
      const unquotedValue =
        rawValue.startsWith('"') && rawValue.endsWith('"')
          ? rawValue.slice(1, -1)
          : rawValue.startsWith("'") && rawValue.endsWith("'")
            ? rawValue.slice(1, -1)
            : rawValue

      env[key] = unquotedValue
      return env
    }, {})
}

const envFromFile = loadEnvFile(envFilePath)
const runtimeEnv = {
  ...envFromFile,
  ...process.env,
}

const supabaseUrl = String(runtimeEnv.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = String(runtimeEnv.VITE_SUPABASE_ANON_KEY || '').trim()
const testEmails = String(
  runtimeEnv.SUPABASE_TEST_EMAILS || runtimeEnv.SUPABASE_TEST_EMAIL || '',
)
  .split(/[\n,]/)
  .map((value) => String(value || '').trim())
  .filter(Boolean)
const testPassword = String(runtimeEnv.SUPABASE_TEST_PASSWORD || '').trim()

const contracts = {
  tables: {
    products:
      String(runtimeEnv.VITE_SUPABASE_PRODUCTS_TABLE || defaultContracts.tables.products).trim(),
    sales: String(runtimeEnv.VITE_SUPABASE_SALES_TABLE || defaultContracts.tables.sales).trim(),
    saleItems:
      String(runtimeEnv.VITE_SUPABASE_SALE_ITEMS_TABLE || defaultContracts.tables.saleItems).trim(),
    branches:
      String(runtimeEnv.VITE_SUPABASE_BRANCHES_TABLE || defaultContracts.tables.branches).trim(),
    profiles:
      String(runtimeEnv.VITE_SUPABASE_PROFILES_TABLE || defaultContracts.tables.profiles).trim(),
  },
  views: {
    productCatalog:
      String(
        runtimeEnv.VITE_SUPABASE_PRODUCTS_VIEW || defaultContracts.views.productCatalog,
      ).trim(),
    inventoryCatalog:
      String(
        runtimeEnv.VITE_SUPABASE_INVENTORY_VIEW || defaultContracts.views.inventoryCatalog,
      ).trim(),
  },
}

const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
}

function logResult(status, message) {
  console.log(`${status} ${message}`)
}

function pass(message) {
  results.passed += 1
  logResult('PASS', message)
}

function fail(message, error) {
  results.failed += 1
  logResult('FAIL', message)

  if (error) {
    console.error(error)
  }
}

function skip(message) {
  results.skipped += 1
  logResult('SKIP', message)
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertFiniteNumber(value, message) {
  assert(Number.isFinite(Number(value)), message)
}

function assertRowHasKeys(row, requiredKeys, label) {
  requiredKeys.forEach((key) => {
    assert(key in row, `${label} is missing required field "${key}".`)
  })
}

function summarizeRowCount(rows = []) {
  if (!Array.isArray(rows)) {
    return 'no rows'
  }

  if (rows.length === 0) {
    return '0 rows'
  }

  if (rows.length === 1) {
    return '1 row'
  }

  return `${rows.length} rows`
}

async function runQueryCheck(label, queryFactory, options = {}) {
  const { validateRows = null, allowEmpty = true } = options
  const { data, error } = await queryFactory()

  if (error) {
    throw error
  }

  const rows = Array.isArray(data) ? data : data ? [data] : []

  if (!allowEmpty) {
    assert(rows.length > 0, `${label} returned no rows.`)
  }

  if (rows.length > 0 && typeof validateRows === 'function') {
    validateRows(rows)
  }

  pass(`${label} is reachable and returned ${summarizeRowCount(rows)}.`)
  return rows
}

function buildProfileSelectQuery() {
  return [
    'id',
    'username',
    'full_name',
    'role_key',
    'branch_id',
    'status',
    'created_at',
    'updated_at',
    `branch:${contracts.tables.branches}(id,name,code,status)`,
  ].join(',')
}

function validateBranchRows(rows) {
  rows.forEach((row, index) => {
    const label = `branches row ${index + 1}`
    assertRowHasKeys(
      row,
      [
        'id',
        'code',
        'name',
        'status',
        'manager_name',
        'contact_number',
        'address',
        'opening_date',
        'notes',
        'created_at',
        'updated_at',
      ],
      label,
    )
    assert(Number.isFinite(Number(row.id)), `${label} has an invalid id.`)
    assert(normalizeText(row.code), `${label} is missing code.`)
    assert(normalizeText(row.name), `${label} is missing name.`)
    assert(normalizeText(row.status), `${label} is missing status.`)
  })
}

function validateProductCatalogRows(rows) {
  rows.forEach((row, index) => {
    const label = `product_catalog_view row ${index + 1}`
    assertRowHasKeys(
      row,
      [
        'product_id',
        'branch',
        'branch_code',
        'branch_name',
        'category_id',
        'category_name',
        'barcode',
        'product_name',
        'unit_label',
        'default_price',
        'is_active',
      ],
      label,
    )
    assert(Number.isFinite(Number(row.product_id)), `${label} has an invalid product_id.`)
    assert(normalizeText(row.branch_name || row.branch), `${label} is missing branch_name.`)
    assert(normalizeText(row.category_name), `${label} is missing category_name.`)
    assert(normalizeText(row.product_name), `${label} is missing product_name.`)
    assertFiniteNumber(row.default_price, `${label} has an invalid default_price.`)
    assert(typeof row.is_active === 'boolean', `${label} has an invalid is_active value.`)
  })
}

function validateInventoryCatalogRows(rows) {
  rows.forEach((row, index) => {
    const label = `inventory_catalog_view row ${index + 1}`
    assertRowHasKeys(
      row,
      [
        'inventory_item_id',
        'branch_id',
        'branch_code',
        'branch_name',
        'product_id',
        'product_branch',
        'category_id',
        'category_name',
        'barcode',
        'product_name',
        'unit_label',
        'price',
        'default_price',
        'selling_price',
        'stock_quantity',
        'reorder_level',
        'expiration_date',
        'legacy_stock_text',
        'is_active',
      ],
      label,
    )
    assert(
      Number(row.inventory_item_id) === Number(row.product_id),
      `${label} should keep inventory_item_id aligned with product_id after schema cleanup.`,
    )
    assert(Number.isFinite(Number(row.branch_id)), `${label} has an invalid branch_id.`)
    assert(normalizeText(row.branch_name), `${label} is missing branch_name.`)
    assert(normalizeText(row.category_name), `${label} is missing category_name.`)
    assert(normalizeText(row.product_name), `${label} is missing product_name.`)
    assertFiniteNumber(row.price, `${label} has an invalid price.`)
    assertFiniteNumber(row.default_price, `${label} has an invalid default_price.`)
    assertFiniteNumber(row.selling_price, `${label} has an invalid selling_price.`)
    assertFiniteNumber(row.stock_quantity, `${label} has an invalid stock_quantity.`)
    assertFiniteNumber(row.reorder_level, `${label} has an invalid reorder_level.`)
    assert(Number(row.stock_quantity) >= 0, `${label} has negative stock_quantity.`)
    assert(Number(row.reorder_level) >= 0, `${label} has negative reorder_level.`)
    assert(typeof row.is_active === 'boolean', `${label} has an invalid is_active value.`)
  })
}

function validateProductRows(rows) {
  rows.forEach((row, index) => {
    const label = `products row ${index + 1}`
    assertRowHasKeys(
      row,
      [
        'id',
        'branch_id',
        'branch',
        'category',
        'barcode',
        'product_name',
        'net_weight',
        'price',
        'stock_quantity',
        'reorder_level',
        'is_active',
        'expiration_date',
      ],
      label,
    )
    assert(Number.isFinite(Number(row.id)), `${label} has an invalid id.`)
    assert(Number.isFinite(Number(row.branch_id)), `${label} has an invalid branch_id.`)
    assert(normalizeText(row.branch), `${label} is missing branch.`)
    assert(normalizeText(row.category), `${label} is missing category.`)
    assert(normalizeText(row.product_name), `${label} is missing product_name.`)
    assertFiniteNumber(row.price, `${label} has an invalid price.`)
    assertFiniteNumber(row.stock_quantity, `${label} has an invalid stock_quantity.`)
    assertFiniteNumber(row.reorder_level, `${label} has an invalid reorder_level.`)
    assert(typeof row.is_active === 'boolean', `${label} has an invalid is_active value.`)
  })
}

function validateSalesRows(rows) {
  rows.forEach((row, index) => {
    const label = `sales row ${index + 1}`
    assertRowHasKeys(
      row,
      [
        'id',
        'cashier_id',
        'cashier_name',
        'branch_id',
        'branch_name',
        'payment_method',
        'subtotal',
        'discount',
        'total_amount',
        'cash_received',
        'change_amount',
        'notes',
        'submitted_at',
      ],
      label,
    )
    assert(Number.isFinite(Number(row.id)), `${label} has an invalid id.`)
    assert(normalizeText(row.cashier_id), `${label} is missing cashier_id.`)
    assert(normalizeText(row.cashier_name), `${label} is missing cashier_name.`)
    assert(Number.isFinite(Number(row.branch_id)), `${label} has an invalid branch_id.`)
    assert(normalizeText(row.branch_name), `${label} is missing branch_name.`)
    assert(normalizeText(row.payment_method), `${label} is missing payment_method.`)
    assertFiniteNumber(row.subtotal, `${label} has an invalid subtotal.`)
    assertFiniteNumber(row.discount, `${label} has an invalid discount.`)
    assertFiniteNumber(row.total_amount, `${label} has an invalid total_amount.`)
    assertFiniteNumber(row.cash_received, `${label} has an invalid cash_received.`)
    assertFiniteNumber(row.change_amount, `${label} has an invalid change_amount.`)
    assert(normalizeText(row.submitted_at), `${label} is missing submitted_at.`)
  })
}

function validateSaleItemRows(rows) {
  rows.forEach((row, index) => {
    const label = `sale_items row ${index + 1}`
    assertRowHasKeys(
      row,
      [
        'id',
        'sale_id',
        'product_id',
        'inventory_item_id',
        'item_name',
        'quantity',
        'unit_price',
        'line_total',
      ],
      label,
    )
    assert(Number.isFinite(Number(row.id)), `${label} has an invalid id.`)
    assert(Number.isFinite(Number(row.sale_id)), `${label} has an invalid sale_id.`)
    assert(normalizeText(row.item_name), `${label} is missing item_name.`)
    assertFiniteNumber(row.quantity, `${label} has an invalid quantity.`)
    assertFiniteNumber(row.unit_price, `${label} has an invalid unit_price.`)
    assertFiniteNumber(row.line_total, `${label} has an invalid line_total.`)

    if (row.product_id != null) {
      assert(
        Number(row.product_id) === Number(row.inventory_item_id),
        `${label} should keep inventory_item_id aligned with product_id for product-backed sale lines.`,
      )
    }
  })
}

function validateProfileRows(rows) {
  rows.forEach((row, index) => {
    const label = `profiles row ${index + 1}`
    assertRowHasKeys(
      row,
      [
        'id',
        'username',
        'full_name',
        'role_key',
        'branch_id',
        'status',
        'created_at',
        'updated_at',
        'branch',
      ],
      label,
    )
    assert(normalizeText(row.id), `${label} is missing id.`)
    assert(normalizeText(row.username), `${label} is missing username.`)
    assert(normalizeText(row.full_name), `${label} is missing full_name.`)
    assert(normalizeText(row.role_key), `${label} is missing role_key.`)
    assert(normalizeText(row.status), `${label} is missing status.`)

    if (normalizeText(row.role_key).toLowerCase() !== 'admin') {
      assert(row.branch != null, `${label} is missing joined branch data.`)
    }
  })
}

function validateInventoryBranchFilter(rows, expectedBranchId) {
  rows.forEach((row, index) => {
    assert(
      Number(row.branch_id) === Number(expectedBranchId),
      `Filtered inventory row ${index + 1} leaked branch_id ${row.branch_id}; expected ${expectedBranchId}.`,
    )
  })
}

function validateCrossSourceContracts({
  productRows,
  productCatalogRows,
  inventoryCatalogRows,
  salesRows,
  saleItemRows,
}) {
  const productsById = new Map(
    productRows.map((row) => [String(row.id), row]),
  )

  inventoryCatalogRows.forEach((row, index) => {
    const matchingProduct = productsById.get(String(row.product_id))

    if (!matchingProduct) {
      return
    }

    assert(
      normalizeText(matchingProduct.product_name) === normalizeText(row.product_name),
      `inventory_catalog_view row ${index + 1} has product_name drift from products.`,
    )
    assert(
      normalizeText(matchingProduct.category) === normalizeText(row.category_name),
      `inventory_catalog_view row ${index + 1} has category drift from products.`,
    )
    assert(
      normalizeText(matchingProduct.barcode) === normalizeText(row.barcode),
      `inventory_catalog_view row ${index + 1} has barcode drift from products.`,
    )
    assert(
      normalizeText(matchingProduct.net_weight) === normalizeText(row.unit_label),
      `inventory_catalog_view row ${index + 1} has unit drift from products.`,
    )
  })

  productCatalogRows.forEach((row, index) => {
    const matchingProduct = productsById.get(String(row.product_id))

    if (!matchingProduct) {
      return
    }

    assert(
      normalizeText(matchingProduct.product_name) === normalizeText(row.product_name),
      `product_catalog_view row ${index + 1} has product_name drift from products.`,
    )
    assert(
      normalizeText(matchingProduct.category) === normalizeText(row.category_name),
      `product_catalog_view row ${index + 1} has category drift from products.`,
    )
    assert(
      normalizeText(matchingProduct.barcode) === normalizeText(row.barcode),
      `product_catalog_view row ${index + 1} has barcode drift from products.`,
    )
  })

  const saleIds = new Set(salesRows.map((row) => String(row.id)))
  saleItemRows.forEach((row, index) => {
    assert(
      saleIds.has(String(row.sale_id)),
      `sale_items row ${index + 1} references sale_id ${row.sale_id} outside the sampled sales result set.`,
    )
  })
}

function validateRoleScopedContracts({
  authUserId,
  currentBranchId,
  currentRoleKey,
  branchRows,
  productRows,
  productCatalogRows,
  inventoryCatalogRows,
  salesRows,
}) {
  if (currentRoleKey === 'admin') {
    return
  }

  assert(
    currentBranchId != null,
    'Employee test account is missing branch_id in profiles.',
  )

  assert(
    branchRows.length === 1,
    'Employee branch query should only expose the assigned branch.',
  )
  assert(
    Number(branchRows[0].id) === Number(currentBranchId),
    `Employee branch query leaked branch ${branchRows[0].id}; expected ${currentBranchId}.`,
  )

  productRows.forEach((row, index) => {
    assert(
      Number(row.branch_id) === Number(currentBranchId),
      `Employee products row ${index + 1} leaked branch_id ${row.branch_id}; expected ${currentBranchId}.`,
    )
  })

  inventoryCatalogRows.forEach((row, index) => {
    assert(
      Number(row.branch_id) === Number(currentBranchId),
      `Employee inventory row ${index + 1} leaked branch_id ${row.branch_id}; expected ${currentBranchId}.`,
    )
  })

  productCatalogRows.forEach((row, index) => {
    assert(
      normalizeText(row.branch_name),
      `Employee product catalog row ${index + 1} is missing branch_name.`,
    )
  })

  salesRows.forEach((row, index) => {
    assert(
      normalizeText(row.cashier_id) === normalizeText(authUserId),
      `Employee sales row ${index + 1} leaked cashier_id ${row.cashier_id}; expected ${authUserId}.`,
    )
  })
}

async function runAccountContractChecks(testEmail, password) {
  const scopedLabel = (label) => `[${testEmail}] ${label}`

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password,
  })

  if (authError) {
    throw authError
  }

  try {
    const authUser = authData?.user
    assert(authUser?.id, 'Authenticated contract check did not return a user id.')
    pass(scopedLabel(`Authenticated test user.`))

    const profileRows = await runQueryCheck(
      scopedLabel('Current user profile contract'),
      () =>
        supabase
          .from(contracts.tables.profiles)
          .select(buildProfileSelectQuery())
          .eq('id', authUser.id)
          .limit(1),
      {
        allowEmpty: false,
        validateRows: validateProfileRows,
      },
    )

    const currentProfile = profileRows[0]
    const currentRoleKey = normalizeText(currentProfile?.role_key).toLowerCase()
    const currentBranchId = currentProfile?.branch_id ?? null

    const branchRows = await runQueryCheck(
      scopedLabel('Branches contract'),
      () =>
        supabase
          .from(contracts.tables.branches)
          .select(
            'id,code,name,status,manager_name,contact_number,address,opening_date,notes,created_at,updated_at',
          )
          .order('name', { ascending: true })
          .limit(10),
      {
        allowEmpty: false,
        validateRows: validateBranchRows,
      },
    )

    const productCatalogRows = await runQueryCheck(
      scopedLabel('Products page catalog view contract'),
      () =>
        supabase
          .from(contracts.views.productCatalog)
          .select(
            'product_id,branch,branch_code,branch_name,category_id,category_name,barcode,product_name,unit_label,default_price,is_active',
          )
          .order('product_name', { ascending: true })
          .limit(10),
      {
        validateRows: validateProductCatalogRows,
      },
    )

    const inventoryCatalogRows = await runQueryCheck(
      scopedLabel('Inventory and POS catalog view contract'),
      () =>
        supabase
          .from(contracts.views.inventoryCatalog)
          .select(
            'inventory_item_id,branch_id,branch_code,branch_name,product_id,product_branch,category_id,category_name,barcode,product_name,unit_label,price,default_price,selling_price,stock_quantity,reorder_level,expiration_date,legacy_stock_text,is_active',
          )
          .order('product_name', { ascending: true })
          .limit(10),
      {
        validateRows: validateInventoryCatalogRows,
      },
    )

    if (currentBranchId != null) {
      await runQueryCheck(
        scopedLabel('Branch-scoped inventory filter contract'),
        () =>
          supabase
            .from(contracts.views.inventoryCatalog)
            .select(
              'inventory_item_id,branch_id,product_id,category_name,barcode,product_name,stock_quantity,reorder_level,is_active',
            )
            .eq('branch_id', Number(currentBranchId))
            .limit(10),
        {
          validateRows: (rows) => validateInventoryBranchFilter(rows, currentBranchId),
        },
      )
    } else {
      skip(scopedLabel('Branch-scoped inventory filter contract skipped because the test user is not tied to a single branch.'))
    }

    const productRows = await runQueryCheck(
      scopedLabel('Products table write-model contract'),
      () =>
        supabase
          .from(contracts.tables.products)
          .select(
            'id,branch_id,branch,category,barcode,product_name,net_weight,price,stock_quantity,reorder_level,is_active,expiration_date',
          )
          .order('id', { ascending: false })
          .limit(10),
      {
        validateRows: validateProductRows,
      },
    )

    const salesRows = await runQueryCheck(
      scopedLabel('Sales history header contract'),
      () =>
        supabase
          .from(contracts.tables.sales)
          .select(
            'id,cashier_id,cashier_name,branch_id,branch_name,payment_method,subtotal,discount,total_amount,cash_received,change_amount,notes,submitted_at',
          )
          .order('submitted_at', { ascending: false })
          .limit(10),
      {
        validateRows: validateSalesRows,
      },
    )

    const sampledSaleIds = salesRows.map((row) => row.id).filter((value) => value != null)

    const saleItemRows = sampledSaleIds.length > 0
      ? await runQueryCheck(
          scopedLabel('Sale items contract'),
          () =>
            supabase
              .from(contracts.tables.saleItems)
              .select(
                'id,sale_id,product_id,inventory_item_id,item_name,quantity,unit_price,line_total',
              )
              .in('sale_id', sampledSaleIds)
              .order('id', { ascending: true })
              .limit(20),
          {
            validateRows: validateSaleItemRows,
          },
        )
      : []

    if (currentRoleKey === 'admin') {
      await runQueryCheck(
        scopedLabel('Users directory profile contract'),
        () =>
          supabase
            .from(contracts.tables.profiles)
            .select(buildProfileSelectQuery())
            .order('full_name', { ascending: true })
            .limit(10),
        {
          validateRows: validateProfileRows,
        },
      )
    } else {
      skip(scopedLabel('Users directory profile contract skipped because the test user is not an admin.'))
    }

    validateCrossSourceContracts({
      productRows,
      productCatalogRows,
      inventoryCatalogRows,
      salesRows,
      saleItemRows,
    })
    pass(scopedLabel('Cross-source Supabase contracts stay aligned across products, views, sales, and sale_items.'))

    const visibleBranchIds = new Set(branchRows.map((row) => String(row.id)))
    inventoryCatalogRows.forEach((row, index) => {
      assert(
        visibleBranchIds.has(String(row.branch_id)),
        `inventory_catalog_view row ${index + 1} references branch_id ${row.branch_id} that is not visible from branches.`,
      )
    })
    pass(scopedLabel('Inventory rows reference visible branch records.'))

    validateRoleScopedContracts({
      authUserId: authUser.id,
      currentBranchId,
      currentRoleKey,
      branchRows,
      productRows,
      productCatalogRows,
      inventoryCatalogRows,
      salesRows,
    })
    pass(scopedLabel(`Role-scoped ${currentRoleKey || 'unknown'} data access matches frontend expectations.`))
  } finally {
    await supabase.auth.signOut()
  }
}

async function main() {
  try {
    assert(supabaseUrl, 'VITE_SUPABASE_URL is missing from apps/web/.env.')
    assert(supabaseAnonKey, 'VITE_SUPABASE_ANON_KEY is missing from apps/web/.env.')
    pass('Supabase URL and anon key are configured.')

    if (testEmails.length === 0 || !testPassword) {
      throw new Error(
        'SUPABASE_TEST_EMAILS (or SUPABASE_TEST_EMAIL) and SUPABASE_TEST_PASSWORD are required for the live authenticated frontend contract check.',
      )
    }

    pass(`Preparing authenticated contract checks for ${testEmails.length} account(s).`)

    for (const testEmail of testEmails) {
      try {
        await runAccountContractChecks(testEmail, testPassword)
      } catch (error) {
        fail(`[${testEmail}] Live Supabase frontend contract check failed.`, error)
      }
    }
  } catch (error) {
    fail('Live Supabase frontend contract check failed.', error)
  }

  console.log(
    `\nSummary: ${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped.`,
  )

  if (results.failed > 0) {
    process.exit(1)
  }
}

await main()
