import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import Loader from '../../../shared/components/common/Loader'
import EmptyState from '../../../shared/components/common/EmptyState'
import CartTable from '../components/CartTable'
import PaymentPanel from '../components/PaymentPanel'
import ProductGrid from '../components/ProductGrid'
import SalesHistoryPanel from '../components/SalesHistoryPanel'
import SelectMenu from '../../../shared/components/ui/SelectMenu'
import NoticeBanner from '../../../shared/components/common/NoticeBanner'
import useAuth from '../../auth/hooks/useAuth'
import { getBranches } from '../../branches/services/branchService'
import { getProducts } from '../../products/services/productService'
import '../styles/pos.css'
import { mergeProductAndStoredCategories } from '../../../shared/utils/storage'
import { normalizeSearchInput } from '../../../shared/utils/validation'
import {
  getRoleLabel,
  isAdminUser,
  isEmployeeUser,
} from '../../../shared/utils/permissions'

const PRODUCTS_PER_PAGE = 12

function buildPaginationItems(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 'end-ellipsis', totalPages]
  }

  if (currentPage >= totalPages - 2) {
    return [1, 'start-ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }

  return [
    1,
    'start-ellipsis',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    'end-ellipsis',
    totalPages,
  ]
}

function PosPage() {
  const { user } = useAuth()
  const canUseSalesDesk = isEmployeeUser(user)
  const [branchOptions, setBranchOptions] = useState([])
  const [isBranchLoading, setIsBranchLoading] = useState(true)
  const [branchLoadError, setBranchLoadError] = useState('')
  const [clock, setClock] = useState(() => new Date())
  const [catalogProducts, setCatalogProducts] = useState([])
  const [catalogError, setCatalogError] = useState('')
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [cartItems, setCartItems] = useState([])
  const [transactionSequence, setTransactionSequence] = useState(1)
  const [activeBranchId, setActiveBranchId] = useState(user?.branchId || '')
  const [activeView, setActiveView] = useState(
    canUseSalesDesk ? 'desk' : 'history',
  )
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const deferredSearchTerm = useDeferredValue(searchTerm)

  useEffect(() => {
    setActiveView(canUseSalesDesk ? 'desk' : 'history')
  }, [canUseSalesDesk])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Date())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadBranches = async () => {
      try {
        setIsBranchLoading(true)
        const branches = await getBranches()

        if (!isMounted) {
          return
        }

        setBranchOptions(branches)
        setBranchLoadError('')
        setActiveBranchId((currentBranchId) => {
          if (user?.branchId) {
            return user.branchId
          }

          const hasCurrentBranch = branches.some(
            (branch) => Number(branch.id) === Number(currentBranchId),
          )

          if (hasCurrentBranch) {
            return currentBranchId
          }

          return branches[0]?.id || ''
        })
      } catch (error) {
        console.error('Failed to load sales branch options:', error)

        if (!isMounted) {
          return
        }

        setBranchOptions([])
        setBranchLoadError(
          error.response?.data?.message || 'Unable to load branch options.',
        )
      } finally {
        if (isMounted) {
          setIsBranchLoading(false)
        }
      }
    }

    loadBranches()

    return () => {
      isMounted = false
    }
  }, [user?.branchId])

  const activeBranch = useMemo(
    () =>
      branchOptions.find((branch) => Number(branch.id) === Number(activeBranchId)) ||
      null,
    [activeBranchId, branchOptions],
  )

  useEffect(() => {
    if (!canUseSalesDesk) {
      setIsCatalogLoading(false)
      return
    }

    if (!activeBranchId) {
      return
    }

    const loadCatalog = async () => {
      try {
        const products = await getProducts({ branchId: activeBranchId })
        setCatalogProducts(products)
        setCatalogError('')
      } catch (error) {
        console.error('Failed to load sales products:', error)
        setCatalogProducts([])
        setCatalogError(
          error.response?.data?.message || 'Unable to load products.',
        )
      } finally {
        setIsCatalogLoading(false)
      }
    }

    setIsCatalogLoading(true)
    loadCatalog()
  }, [activeBranchId, canUseSalesDesk])

  const formattedDate = new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(clock)

  const formattedTime = new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(clock)

  const categories = useMemo(
    () => ['All', ...mergeProductAndStoredCategories(catalogProducts)],
    [catalogProducts],
  )
  const transactionNumber = `TRX-${clock.toISOString().slice(0, 10).replaceAll('-', '')}-${String(transactionSequence).padStart(3, '0')}`
  const cashierRoleLabel = getRoleLabel(user?.roleKey || user?.role)
  const transactionSuffix = String(transactionSequence).padStart(3, '0')
  const workspaceLabel = activeView === 'history' ? 'Sales History' : 'Sales Desk'

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeSearchInput(deferredSearchTerm).toLowerCase()

    return catalogProducts.filter((product) => {
      const matchesCategory =
        activeCategory === 'All' || product.category === activeCategory
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [
          product.name,
          product.category,
          product.unit,
          product.branchName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)

      return matchesCategory && matchesSearch
    })
  }, [activeCategory, catalogProducts, deferredSearchTerm])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeBranchId, activeCategory, deferredSearchTerm])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE),
  )

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE
    return filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE)
  }, [currentPage, filteredProducts])

  const visiblePaginationItems = useMemo(
    () => buildPaginationItems(currentPage, totalPages),
    [currentPage, totalPages],
  )

  const pageRangeStart =
    filteredProducts.length === 0 ? 0 : (currentPage - 1) * PRODUCTS_PER_PAGE + 1
  const pageRangeEnd = Math.min(
    currentPage * PRODUCTS_PER_PAGE,
    filteredProducts.length,
  )
  const hasActiveSearch = normalizeSearchInput(searchTerm).length > 0

  const handleOrderComplete = (action, details = {}) => {
    if (action !== 'checkout') {
      return
    }

    setTransactionSequence((current) => current + 1)
    setHistoryRefreshKey((current) => current + 1)

    if (details.inventorySynced === false || !Array.isArray(details.soldItems)) {
      return
    }

    setCatalogProducts((previousProducts) =>
      previousProducts.map((product) => {
        const soldItem = details.soldItems.find(
          (item) => String(item.product_id ?? item.id) === String(product.id),
        )

        if (!soldItem) {
          return product
        }

        return {
          ...product,
          stockQuantity: Math.max(
            0,
            Number(product.stockQuantity || 0) - Number(soldItem.quantity || 0),
          ),
        }
      }),
    )
  }

  if (isBranchLoading && !user?.branchId && branchOptions.length === 0) {
    return <Loader message="Loading branch scope..." />
  }

  if (!isBranchLoading && !activeBranchId && !user?.branchId && canUseSalesDesk) {
    return (
        <EmptyState
          title="No branch scope available"
          description="Add at least one branch before loading the sales workspace."
        />
      )
  }

  return (
    <section className="pos-page">
      <div className="pos-topbar">
        <div className="pos-title-block">
          <p className="eyebrow">Sales</p>
          <h1>Sales Workspace</h1>
          <p className="supporting-text">
            Process live orders and review completed transaction history in one workspace.
          </p>
        </div>

        <div className="pos-meta-grid">
          <article className="pos-meta-card">
            <span className="meta-label">Staff Member</span>
            <strong className="meta-primary">{user?.name || 'Admin User'}</strong>
            <span className="meta-secondary">{cashierRoleLabel}</span>
          </article>

          <article className="pos-meta-card">
            <span className="meta-label">Branch Scope</span>
            <strong className="meta-primary">
              {activeBranch?.name || user?.branchName || 'All Branches'}
            </strong>
            <span className="meta-secondary">
              {user?.branchId
                ? 'Assigned branch'
                : 'Select branch'}
            </span>
            {user?.branchId ? null : branchOptions.length > 0 ? (
              <label className="pos-inline-field">
                <span>Active branch</span>
                <SelectMenu
                  className="pos-branch-select"
                  value={activeBranchId}
                  onChange={(event) => setActiveBranchId(Number(event.target.value))}
                  id="active-pos-branch-select"
                  placeholder="Select active sales branch"
                  options={branchOptions.map((branch) => ({
                    value: branch.id,
                    label: branch.name
                  }))}
                />
              </label>
            ) : null}
          </article>

          <article className="pos-meta-card">
            <span className="meta-label">Date and Time</span>
            <strong className="meta-primary meta-primary--clock">{formattedTime}</strong>
            <span className="meta-secondary">{formattedDate}</span>
            <span className="meta-tertiary">PST</span>
          </article>

          <article className="pos-meta-card">
            <span className="meta-label">
              {activeView === 'history' ? 'Current Workspace' : 'Transaction No.'}
            </span>
            {activeView === 'history' ? (
              <>
                <strong className="meta-primary">{workspaceLabel}</strong>
                <span className="meta-secondary">
                  Review saved transactions without changing recorded data.
                </span>
                <span className="meta-tertiary">
                  {isAdminUser(user) ? 'Administrator access' : 'Account-scoped records'}
                </span>
              </>
            ) : (
              <>
                <strong className="meta-code">{transactionNumber}</strong>
                <span className="meta-secondary">Current sale</span>
                <span className="meta-tertiary">Sequence {transactionSuffix}</span>
              </>
            )}
          </article>
        </div>
      </div>

      <div className="pos-view-switcher">
        {canUseSalesDesk ? (
          <button
            type="button"
            className={activeView === 'desk' ? 'pos-view-button active' : 'pos-view-button'}
            onClick={() => setActiveView('desk')}
          >
            Sales Desk
          </button>
        ) : null}
        <button
          type="button"
          className={activeView === 'history' ? 'pos-view-button active' : 'pos-view-button'}
          onClick={() => setActiveView('history')}
        >
          Sales History
        </button>
      </div>

      {activeView === 'history' ? (
        <SalesHistoryPanel
          branchOptions={branchOptions}
          refreshKey={historyRefreshKey}
          user={user}
        />
      ) : (
        <div className="pos-layout">
          <section className="pos-left">
            <div className="pos-panel">
              <div className="panel-header">
                <div>
                  <p className="card-label">Products</p>
                  <h2>Available Items</h2>
                </div>
                <span className="panel-count">{filteredProducts.length} items</span>
              </div>

              {catalogError ? (
                <NoticeBanner
                  variant="error"
                  title="Product catalog unavailable"
                  message={catalogError}
                />
              ) : null}

              {branchLoadError ? (
                <NoticeBanner
                  variant="error"
                  title="Branch scope unavailable"
                  message={branchLoadError}
                />
              ) : null}

              <div className="product-grid-toolbar">
                <div className="product-grid-search-row">
                  <input
                    type="text"
                    className="pos-search"
                    placeholder="Search product, category, or pack size"
                    value={searchTerm}
                    aria-label="Search available products"
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />

                  {hasActiveSearch ? (
                    <button
                      type="button"
                      className="ghost-action product-grid-clear-search"
                      onClick={() => setSearchTerm('')}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="category-row">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={
                        activeCategory === category
                          ? 'category-button active'
                          : 'category-button'
                      }
                      onClick={() => setActiveCategory(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <div className="product-grid-summary">
                <p className="product-grid-results">
                  {filteredProducts.length === 0
                    ? 'No matching products found.'
                    : `Showing ${pageRangeStart}-${pageRangeEnd} of ${filteredProducts.length} matching item${
                        filteredProducts.length === 1 ? '' : 's'
                      }.`}
                </p>

                {totalPages > 1 ? (
                  <div className="product-grid-pagination">
                    <button
                      type="button"
                      className="pagination-button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      aria-label="Go to previous product page"
                    >
                      Previous
                    </button>

                    {visiblePaginationItems.map((item) => {
                      if (typeof item !== 'number') {
                        return (
                          <span
                            key={item}
                            className="pagination-ellipsis"
                          >
                            ...
                          </span>
                        )
                      }

                      return (
                        <button
                          key={item}
                          type="button"
                          className={
                            item === currentPage
                              ? 'pagination-button active'
                              : 'pagination-button'
                          }
                          onClick={() => setCurrentPage(item)}
                          aria-label={`Go to product page ${item}`}
                          aria-current={item === currentPage ? 'page' : undefined}
                        >
                          {item}
                        </button>
                      )
                    })}

                    <button
                      type="button"
                      className="pagination-button"
                      onClick={() =>
                        setCurrentPage((page) => Math.min(totalPages, page + 1))
                      }
                      disabled={currentPage === totalPages}
                      aria-label="Go to next product page"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>

              {isCatalogLoading ? (
                <Loader message="Loading sales catalog..." />
              ) : (
                <ProductGrid
                  cart={cartItems}
                  products={paginatedProducts}
                  setCart={setCartItems}
                />
              )}
            </div>
          </section>

          <aside className="cart-panel">
            <div className="panel-header">
              <div>
                <p className="card-label">Cart</p>
                <h2>Current Order</h2>
              </div>
            </div>

            <CartTable
              cart={cartItems}
              setCart={setCartItems}
            />

            <PaymentPanel
              cart={cartItems}
              setCart={setCartItems}
              transactionNumber={transactionNumber}
              branchId={activeBranch?.id ?? user?.branchId ?? null}
              branchName={activeBranch?.name || user?.branchName || 'All Branches'}
              onOrderComplete={handleOrderComplete}
            />
          </aside>
        </div>
      )}
    </section>
  )
}

export default PosPage
