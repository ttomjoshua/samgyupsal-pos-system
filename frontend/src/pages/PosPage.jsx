import { useEffect, useMemo, useState } from 'react'
import Loader from '../components/common/Loader'
import EmptyState from '../components/common/EmptyState'
import CartTable from '../components/pos/CartTable'
import PaymentPanel from '../components/pos/PaymentPanel'
import ProductGrid from '../components/pos/ProductGrid'
import NoticeBanner from '../components/common/NoticeBanner'
import useAuth from '../hooks/useAuth'
import { getBranches } from '../services/branchService'
import { getProducts } from '../services/productService'
import '../styles/pos.css'
import { mergeProductAndStoredCategories } from '../utils/storage'
import { normalizeSearchInput } from '../utils/validation'

function PosPage() {
  const { user } = useAuth()
  const [branchOptions, setBranchOptions] = useState([])
  const [isBranchLoading, setIsBranchLoading] = useState(true)
  const [branchLoadError, setBranchLoadError] = useState('')
  const [clock, setClock] = useState(() => new Date())
  const [catalogProducts, setCatalogProducts] = useState([])
  const [catalogSource, setCatalogSource] = useState(
    'Loading products from the backend...',
  )
  const [catalogError, setCatalogError] = useState('')
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [cartItems, setCartItems] = useState([])
  const [transactionSequence, setTransactionSequence] = useState(1)
  const [activeBranchId, setActiveBranchId] = useState(user?.branchId || '')

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
        console.error('Failed to load branch options for POS:', error)

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
    if (!activeBranchId) {
      return
    }

    const loadCatalog = async () => {
      try {
        const products = await getProducts({ branchId: activeBranchId })
        setCatalogProducts(products)
        setCatalogSource(
          `Products loaded for ${activeBranch?.name || 'the selected branch'}.`,
        )
        setCatalogError('')
      } catch (error) {
        console.error('Failed to load POS products:', error)
        setCatalogProducts([])
        setCatalogSource('Backend product catalog unavailable for this branch.')
        setCatalogError(
          error.response?.data?.message || 'Unable to load products.',
        )
      } finally {
        setIsCatalogLoading(false)
      }
    }

    setIsCatalogLoading(true)
    loadCatalog()
  }, [activeBranch?.name, activeBranchId])

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

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeSearchInput(searchTerm).toLowerCase()

    return catalogProducts.filter((product) => {
      const matchesCategory =
        activeCategory === 'All' || product.category === activeCategory
      const matchesSearch =
        normalizedSearch.length === 0 ||
        product.name.toLowerCase().includes(normalizedSearch)

      return matchesCategory && matchesSearch
    })
  }, [activeCategory, catalogProducts, searchTerm])

  if (isBranchLoading && !user?.branchId && branchOptions.length === 0) {
    return <Loader message="Loading branch scope..." />
  }

  if (!isBranchLoading && !activeBranchId && !user?.branchId) {
    return (
      <EmptyState
        title="No branch scope available"
        description="Add at least one branch before loading the POS screen."
      />
    )
  }

  return (
    <section className="pos-page">
      <div className="pos-topbar">
        <div className="pos-title-block">
          <p className="eyebrow">Primary Business Screen</p>
          <h1>Point of Sale</h1>
          <p className="supporting-text">
            Start transactions here before wiring the real cart behavior and checkout flow.
          </p>
        </div>

        <div className="pos-meta-grid">
          <article className="pos-meta-card">
            <span className="meta-label">Cashier</span>
            <strong>{user?.name || 'Admin User'}</strong>
          </article>

          <article className="pos-meta-card">
            <span className="meta-label">Branch Scope</span>
            <strong>{activeBranch?.name || user?.branchName || 'All Branches'}</strong>
            {user?.branchId ? null : branchOptions.length > 0 ? (
              <select
                className="pos-branch-select"
                value={activeBranchId}
                onChange={(event) => setActiveBranchId(Number(event.target.value))}
              >
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            ) : null}
          </article>

          <article className="pos-meta-card">
            <span className="meta-label">Date and Time</span>
            <strong>{formattedDate}</strong>
            <span className="meta-copy">{formattedTime}</span>
          </article>

          <article className="pos-meta-card">
            <span className="meta-label">Transaction No.</span>
            <strong>{transactionNumber}</strong>
          </article>
        </div>
      </div>

      <div className="pos-layout">
        <section className="pos-left">
          <div className="pos-panel">
            <div className="panel-header">
              <div>
                <p className="card-label">Product Search</p>
                <h2>Browse menu and store items</h2>
                <p className="supporting-text">{catalogSource}</p>
              </div>
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

            <input
              type="text"
              className="pos-search"
              placeholder="Search product"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />

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

          <div className="pos-panel">
            <div className="panel-header">
              <div>
                <p className="card-label">Product Grid</p>
                <h2>Available items</h2>
              </div>
              <span className="panel-count">{filteredProducts.length} items</span>
            </div>

            {isCatalogLoading ? (
              <Loader message="Loading POS catalog..." />
            ) : (
              <ProductGrid
                products={filteredProducts}
                setCart={setCartItems}
              />
            )}
          </div>
        </section>

        <aside className="cart-panel">
          <div className="panel-header">
            <div>
              <p className="card-label">Cart Panel</p>
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
            onOrderComplete={(action) => {
              if (action === 'checkout') {
                setTransactionSequence((current) => current + 1)
              }
            }}
          />
        </aside>
      </div>
    </section>
  )
}

export default PosPage
