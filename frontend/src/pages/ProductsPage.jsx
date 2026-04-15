import { useEffect, useState } from 'react'
import EmptyState from '../components/common/EmptyState'
import Loader from '../components/common/Loader'
import NoticeBanner from '../components/common/NoticeBanner'
import { getProductCatalog } from '../services/productService'
import { isSupabaseConfigured } from '../services/supabaseClient'
import {
  getStoredCategories,
  mergeProductAndStoredCategories,
  prepareCategoryName,
  saveStoredCategories,
} from '../utils/storage'
import { peso } from '../utils/formatters'

function ProductsPage() {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [sourceLabel, setSourceLabel] = useState('Loading products...')
  const [customCategories, setCustomCategories] = useState(() =>
    getStoredCategories(),
  )
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryMessage, setCategoryMessage] = useState(
    'Add categories here for future owner/admin product organization.',
  )
  const [categoryMessageTone, setCategoryMessageTone] = useState('info')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productList = await getProductCatalog()
        setProducts(productList)
        setSourceLabel(
          isSupabaseConfigured
            ? 'Loaded from the active Supabase catalog.'
            : 'Loaded from the fallback product catalog.',
        )
        setLoadError('')
      } catch (error) {
        console.error('Failed to load products:', error)
        setProducts([])
        setSourceLabel('Unable to load products from the active catalog source.')
        setLoadError(
          error.response?.data?.message ||
            'The product list could not be loaded from the active catalog source.',
        )
      } finally {
        setIsLoading(false)
      }
    }

    fetchProducts()
  }, [])

  const availableCategories = mergeProductAndStoredCategories(products)
  const productCategories = Array.from(
    new Set(products.map((item) => prepareCategoryName(item.category || '')).filter(Boolean)),
  )

  const isCustomCategory = (categoryName) =>
    customCategories.some(
      (category) => category.toLowerCase() === categoryName.toLowerCase(),
    )

  const isProductCategory = (categoryName) =>
    productCategories.some(
      (category) => category.toLowerCase() === categoryName.toLowerCase(),
    )

  const handleAddCategory = (event) => {
    event.preventDefault()

    const normalizedCategory = prepareCategoryName(newCategoryName)

    if (!normalizedCategory) {
      setCategoryMessageTone('warning')
      setCategoryMessage('Enter a category name before saving.')
      return
    }

    const categoryExists = availableCategories.some(
      (category) => category.toLowerCase() === normalizedCategory.toLowerCase(),
    )

    if (categoryExists) {
      setCategoryMessageTone('warning')
      setCategoryMessage(`"${normalizedCategory}" already exists.`)
      return
    }

    const nextCategories = [...customCategories, normalizedCategory]
    setCustomCategories(nextCategories)
    saveStoredCategories(nextCategories)
    setNewCategoryName('')
    setCategoryMessageTone('success')
    setCategoryMessage(
      `"${normalizedCategory}" added. It will appear in the POS category filters.`,
    )
  }

  const handleRemoveCategory = (categoryToRemove) => {
    const nextCategories = customCategories.filter(
      (category) => category.toLowerCase() !== categoryToRemove.toLowerCase(),
    )

    setCustomCategories(nextCategories)
    saveStoredCategories(nextCategories)
    setCategoryMessageTone('success')
    setCategoryMessage(
      isProductCategory(categoryToRemove)
        ? `"${categoryToRemove}" was removed from local admin categories, but it still appears because existing product data uses it.`
        : `"${categoryToRemove}" was removed from local admin categories.`,
    )
  }

  return (
    <section className="page-shell">
      <div className="panel">
        <p className="eyebrow">Products</p>
        <h2>Product Catalog</h2>
        <p className="supporting-text">{sourceLabel}</p>
      </div>

      {loadError ? (
        <NoticeBanner
          variant="error"
          title="Products could not be loaded"
          message={loadError}
        />
      ) : null}

      <div className="products-management-grid">
        <div className="panel">
          <p className="card-label">Category Management</p>
          <h2>Owner / Admin Categories</h2>
          <p className="supporting-text">
            Create categories for product organization and future POS filtering.
          </p>

          <form className="category-manager-form" onSubmit={handleAddCategory}>
            <input
              type="text"
              placeholder="Add category name"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
            />
            <button type="submit" className="primary-button">
              Add Category
            </button>
          </form>

          <NoticeBanner
            variant={categoryMessageTone}
            title="Category management"
            message={categoryMessage}
          />

          <div className="category-section">
            <div className="category-section-header">
              <strong>Locally managed categories</strong>
              <span>These can be removed safely from the frontend admin list.</span>
            </div>

            {customCategories.length === 0 ? (
              <EmptyState
                title="No custom categories yet"
                description="Add one here if the owner wants extra category filters beyond the current product catalog."
              />
            ) : (
              <div className="category-chip-list">
                {customCategories.map((category) => (
                  <div key={category} className="category-chip removable">
                    <span>{category}</span>
                    <button
                      type="button"
                      className="category-chip-remove"
                      onClick={() => handleRemoveCategory(category)}
                      aria-label={`Remove ${category} category`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="category-section">
            <div className="category-section-header">
              <strong>Visible category filters</strong>
              <span>
                Product-backed categories stay visible even if the local admin copy is removed.
              </span>
            </div>

            <div className="category-chip-list">
              {availableCategories.map((category) => (
                <div key={category} className="category-chip">
                  <span>{category}</span>
                  {isCustomCategory(category) ? (
                    <span className="category-chip-meta">Local</span>
                  ) : null}
                  {isProductCategory(category) ? (
                    <span className="category-chip-meta">Product</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <p className="card-label">Products</p>
          <h2>Catalog Preview</h2>
          <p className="supporting-text">
            Products are loaded from Supabase when configured, otherwise from the fallback catalog path.
          </p>

          {isLoading ? (
            <Loader message="Loading products..." />
          ) : loadError ? (
            <EmptyState
              title="Products are currently unavailable"
              description="The page is still responsive, but the product catalog could not be loaded from the current data source."
            />
          ) : products.length === 0 ? (
            <EmptyState
              title="No products available"
              description="Seed the Supabase catalog or reconnect the fallback product source."
            />
          ) : (
            products.map((item) => (
              <p key={item.id}>
                {item.name} - {item.category} - {item.branchName || 'Unassigned Branch'} - {peso(item.price)}
              </p>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

export default ProductsPage
