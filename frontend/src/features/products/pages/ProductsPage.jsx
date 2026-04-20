import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import EmptyState from '../../../shared/components/common/EmptyState'
import Loader from '../../../shared/components/common/Loader'
import NoticeBanner from '../../../shared/components/common/NoticeBanner'
import PaginationControls from '../../../shared/components/common/PaginationControls'
import Modal from '../../../shared/components/ui/Modal'
import {
  getProductCatalog,
  removeProductCategory,
  renameProductCategory,
} from '../services/productService'
import {
  getStoredCategories,
  prepareCategoryName,
  saveStoredCategories,
} from '../../../shared/utils/storage'
import { peso } from '../../../shared/utils/formatters'
import '../styles/products.css'

const CATEGORY_PAGE_SIZE = 8
const PRODUCT_PREVIEW_PAGE_SIZE = 10
const VISIBLE_CATEGORY_PAGE_SIZE = 8

function ProductsPage() {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const [customCategories, setCustomCategories] = useState(() =>
    getStoredCategories(),
  )
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryMessage, setCategoryMessage] = useState(
    'Add categories to organize and filter products.',
  )
  const [categoryMessageTone, setCategoryMessageTone] = useState('info')
  const [loadError, setLoadError] = useState('')
  const [categoryPage, setCategoryPage] = useState(1)
  const [productPage, setProductPage] = useState(1)
  const [visibleCategoryPage, setVisibleCategoryPage] = useState(1)
  const [categorySearch, setCategorySearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [categoryEditor, setCategoryEditor] = useState(null)
  const [categoryEditorName, setCategoryEditorName] = useState('')
  const [categoryEditorError, setCategoryEditorError] = useState('')
  const [isSavingCategoryEdit, setIsSavingCategoryEdit] = useState(false)
  const [categoryRemovalTarget, setCategoryRemovalTarget] = useState(null)
  const [categoryRemovalError, setCategoryRemovalError] = useState('')
  const [isRemovingCategory, setIsRemovingCategory] = useState(false)
  const deferredCategorySearch = useDeferredValue(categorySearch)
  const deferredProductSearch = useDeferredValue(productSearch)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productList = await getProductCatalog()
        setProducts(productList)
        setLoadError('')
      } catch (error) {
        console.error('Failed to load products:', error)
        setProducts([])

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

  const productCategories = useMemo(
    () => Array.from(
      new Set(products.map((item) => prepareCategoryName(item.category || '')).filter(Boolean)),
    ),
    [products],
  )
  const availableCategories = useMemo(
    () => Array.from(new Set([...productCategories, ...customCategories])),
    [customCategories, productCategories],
  )
  const customCategoryRows = useMemo(
    () => [...customCategories].sort((left, right) => left.localeCompare(right)),
    [customCategories],
  )
  const visibleCategoryRows = useMemo(
    () =>
      [...availableCategories]
        .sort((left, right) => left.localeCompare(right))
        .map((category) => ({
          name: category,
          isCustom: customCategories.some(
            (storedCategory) =>
              storedCategory.toLowerCase() === category.toLowerCase(),
          ),
          isProduct: productCategories.some(
            (productCategory) =>
              productCategory.toLowerCase() === category.toLowerCase(),
          ),
        })),
    [availableCategories, customCategories, productCategories],
  )
  const productUsageByCategory = useMemo(() => {
    const usageMap = new Map()

    products.forEach((product) => {
      const categoryName = prepareCategoryName(product.category || 'Uncategorized')
      usageMap.set(categoryName, (usageMap.get(categoryName) || 0) + 1)
    })

    return usageMap
  }, [products])
  const normalizedCategorySearch = deferredCategorySearch.trim().toLowerCase()
  const normalizedProductSearch = deferredProductSearch.trim().toLowerCase()
  const filteredCustomCategoryRows = useMemo(() => {
    if (!normalizedCategorySearch) {
      return customCategoryRows
    }

    return customCategoryRows.filter((category) =>
      category.toLowerCase().includes(normalizedCategorySearch),
    )
  }, [customCategoryRows, normalizedCategorySearch])
  const filteredVisibleCategoryRows = useMemo(() => {
    if (!normalizedCategorySearch) {
      return visibleCategoryRows
    }

    return visibleCategoryRows.filter((category) =>
      category.name.toLowerCase().includes(normalizedCategorySearch),
    )
  }, [normalizedCategorySearch, visibleCategoryRows])
  const filteredProducts = useMemo(() => {
    if (!normalizedProductSearch) {
      return products
    }

    return products.filter((product) =>
      [product.name, product.category, product.branchName, product.unit]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedProductSearch)),
    )
  }, [normalizedProductSearch, products])
  const visibleProductBranchCount = useMemo(
    () =>
      new Set(
        filteredProducts
          .map((product) => product.branchName)
          .filter(Boolean),
      ).size,
    [filteredProducts],
  )
  const visibleProductCategoryCount = useMemo(
    () =>
      new Set(
        filteredProducts
          .map((product) => prepareCategoryName(product.category || 'Uncategorized'))
          .filter(Boolean),
      ).size,
    [filteredProducts],
  )
  const categoryTotalPages = Math.max(
    1,
    Math.ceil(filteredCustomCategoryRows.length / CATEGORY_PAGE_SIZE),
  )
  const visibleCategoryTotalPages = Math.max(
    1,
    Math.ceil(filteredVisibleCategoryRows.length / VISIBLE_CATEGORY_PAGE_SIZE),
  )
  const productTotalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCT_PREVIEW_PAGE_SIZE),
  )
  const paginatedCustomCategories = useMemo(() => {
    const startIndex = (categoryPage - 1) * CATEGORY_PAGE_SIZE
    return filteredCustomCategoryRows.slice(
      startIndex,
      startIndex + CATEGORY_PAGE_SIZE,
    )
  }, [categoryPage, filteredCustomCategoryRows])
  const paginatedProducts = useMemo(() => {
    const startIndex = (productPage - 1) * PRODUCT_PREVIEW_PAGE_SIZE
    return filteredProducts.slice(startIndex, startIndex + PRODUCT_PREVIEW_PAGE_SIZE)
  }, [filteredProducts, productPage])
  const paginatedVisibleCategories = useMemo(() => {
    const startIndex = (visibleCategoryPage - 1) * VISIBLE_CATEGORY_PAGE_SIZE
    return filteredVisibleCategoryRows.slice(
      startIndex,
      startIndex + VISIBLE_CATEGORY_PAGE_SIZE,
    )
  }, [filteredVisibleCategoryRows, visibleCategoryPage])

  const getProductCategoryUsageCount = (categoryName) =>
    productUsageByCategory.get(
      prepareCategoryName(categoryName || 'Uncategorized'),
    ) || 0

  useEffect(() => {
    setCategoryPage(1)
  }, [customCategories, normalizedCategorySearch])

  useEffect(() => {
    if (categoryPage > categoryTotalPages) {
      setCategoryPage(categoryTotalPages)
    }
  }, [categoryPage, categoryTotalPages])

  useEffect(() => {
    if (productPage > productTotalPages) {
      setProductPage(productTotalPages)
    }
  }, [productPage, productTotalPages])

  useEffect(() => {
    setVisibleCategoryPage(1)
  }, [availableCategories, normalizedCategorySearch])

  useEffect(() => {
    setProductPage(1)
  }, [normalizedProductSearch])

  useEffect(() => {
    if (visibleCategoryPage > visibleCategoryTotalPages) {
      setVisibleCategoryPage(visibleCategoryTotalPages)
    }
  }, [visibleCategoryPage, visibleCategoryTotalPages])

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

  const handleOpenEditCategory = (categoryToEdit, context = null) => {
    setCategoryEditor(
      context || {
        name: categoryToEdit,
        isCustom: isCustomCategory(categoryToEdit),
        isProduct: isProductCategory(categoryToEdit),
      },
    )
    setCategoryEditorName(categoryToEdit)
    setCategoryEditorError('')
  }

  const handleCloseEditCategory = () => {
    setCategoryEditor(null)
    setCategoryEditorName('')
    setCategoryEditorError('')
    setIsSavingCategoryEdit(false)
  }

  const handleOpenRemoveCategory = (categoryToRemove, context = null) => {
    setCategoryRemovalTarget(
      context || {
        name: categoryToRemove,
        isCustom: isCustomCategory(categoryToRemove),
        isProduct: isProductCategory(categoryToRemove),
      },
    )
    setCategoryRemovalError('')
  }

  const handleCloseRemoveCategory = () => {
    setCategoryRemovalTarget(null)
    setCategoryRemovalError('')
    setIsRemovingCategory(false)
  }

  const handleConfirmEditCategory = async (event) => {
    event.preventDefault()

    if (!categoryEditor) {
      return
    }

    const normalizedCategory = prepareCategoryName(categoryEditorName)
    const originalCategory = categoryEditor.name

    if (!normalizedCategory) {
      setCategoryEditorError('Enter a category name before saving.')
      return
    }

    if (normalizedCategory.toLowerCase() === originalCategory.toLowerCase()) {
      setCategoryEditorError('Change the category name before saving.')
      return
    }

    const categoryExists = availableCategories.some(
      (category) =>
        category.toLowerCase() === normalizedCategory.toLowerCase() &&
        category.toLowerCase() !== originalCategory.toLowerCase(),
    )

    if (categoryExists) {
      setCategoryEditorError(`"${normalizedCategory}" already exists.`)
      return
    }

    try {
      setIsSavingCategoryEdit(true)

      if (categoryEditor.isProduct) {
        await renameProductCategory(originalCategory, normalizedCategory)
        setProducts((previousProducts) =>
          previousProducts.map((product) =>
            product.category.toLowerCase() === originalCategory.toLowerCase()
              ? { ...product, category: normalizedCategory }
              : product,
          ),
        )
      }

      if (categoryEditor.isCustom) {
        const nextCategories = customCategories.map((category) =>
          category.toLowerCase() === originalCategory.toLowerCase()
            ? normalizedCategory
            : category,
        )

        setCustomCategories(nextCategories)
        saveStoredCategories(nextCategories)
      }
    } catch (error) {
      setCategoryEditorError(
        error.response?.data?.message ||
          error.message ||
          'Unable to edit this category right now.',
      )
      setIsSavingCategoryEdit(false)
      return
    }

    setCategoryMessageTone('success')
    setCategoryMessage(
      categoryEditor.isProduct
        ? `"${originalCategory}" was renamed to "${normalizedCategory}" across the active catalog.`
        : `"${originalCategory}" was renamed to "${normalizedCategory}".`,
    )
    handleCloseEditCategory()
  }

  const handleConfirmRemoveCategory = async () => {
    if (!categoryRemovalTarget) {
      return
    }

    const categoryToRemove = categoryRemovalTarget.name

    try {
      setIsRemovingCategory(true)

      if (categoryRemovalTarget.isProduct) {
        await removeProductCategory(categoryToRemove)
        setProducts((previousProducts) =>
          previousProducts.map((product) =>
            product.category.toLowerCase() === categoryToRemove.toLowerCase()
              ? { ...product, category: 'Uncategorized' }
              : product,
          ),
        )
      }

      if (categoryRemovalTarget.isCustom) {
        const nextCategories = customCategories.filter(
          (category) => category.toLowerCase() !== categoryToRemove.toLowerCase(),
        )

        setCustomCategories(nextCategories)
        saveStoredCategories(nextCategories)
      }
    } catch (error) {
      setCategoryRemovalError(
        error.response?.data?.message ||
          error.message ||
          'Unable to remove this category right now.',
      )
      setIsRemovingCategory(false)
      return
    }

    setCategoryMessageTone('success')
    setCategoryMessage(
      categoryRemovalTarget.isProduct
        ? `"${categoryToRemove}" was removed from the active catalog and matching products were moved to "Uncategorized".`
        : `"${categoryToRemove}" was removed from local admin categories.`,
    )
    handleCloseRemoveCategory()
  }

  return (
    <section className="page-shell products-page">
      <div className="page-header products-header">
        <div>
          <p className="eyebrow">Products</p>
          <h2>Catalog and Categories</h2>
          <p className="supporting-text">
            Review products and category labels.
          </p>
        </div>
        <div className="page-header-actions">
          <div className="page-header-stat">
            <strong>{products.length}</strong>
            <span>Catalog Items</span>
          </div>
          <div className="page-header-stat">
            <strong>{availableCategories.length}</strong>
            <span>Visible Categories</span>
          </div>
        </div>
      </div>

      {loadError ? (
        <NoticeBanner
          variant="error"
          title="Catalog unavailable"
          message={loadError}
        />
      ) : null}

      <div className="products-management-grid">
        <div className="panel">
          <p className="card-label">Category Management</p>
          <h2>Categories</h2>
          <p className="supporting-text products-panel-copy">
            Keep categories organized for search and filtering.
          </p>

          <div className="products-overview-grid">
            <div className="products-overview-card">
              <span className="products-overview-label">Visible Categories</span>
              <strong>{availableCategories.length}</strong>
              <span className="products-overview-meta">Ready to use</span>
            </div>
            <div className="products-overview-card">
              <span className="products-overview-label">Product-backed</span>
              <strong>{productCategories.length}</strong>
              <span className="products-overview-meta">Used by products</span>
            </div>
            <div className="products-overview-card">
              <span className="products-overview-label">Locally Managed</span>
              <strong>{customCategories.length}</strong>
              <span className="products-overview-meta">Added manually</span>
            </div>
          </div>

          <form className="category-inline-form" onSubmit={handleAddCategory} style={{ marginBottom: '1rem', marginTop: '1rem' }}>
            <input
              type="text"
              className="products-search-input"
              placeholder="Add new category"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              aria-label="Add new category name"
            />
            <button type="submit" className="primary-button" style={{ whiteSpace: 'nowrap' }}>
              Add Category
            </button>
          </form>

          <NoticeBanner
            variant={categoryMessageTone}
            title="Category update"
            message={categoryMessage}
          />

          <div className="products-search-shell" style={{ marginBottom: '1rem' }}>
            <input
              id="category-search"
              type="search"
              className="products-search-input"
              placeholder="Search existing categories..."
              value={categorySearch}
              onChange={(event) => setCategorySearch(event.target.value)}
            />
          </div>

          <div className="category-section">
            <div className="category-section-header">
              <strong>Custom Categories</strong>
              <span>Extra categories added by the admin.</span>
            </div>

            {filteredCustomCategoryRows.length === 0 ? (
              <EmptyState
                title={
                  customCategories.length === 0
                    ? 'No custom categories yet'
                    : 'No local categories match this search'
                }
                description={
                  customCategories.length === 0
                    ? 'Add a category above to get started.'
                    : 'Try a different keyword or clear the search.'
                }
              />
            ) : (
              <>
                <ul className="category-list">
                  {paginatedCustomCategories.map((category) => (
                    <li key={category} className="category-list-item">
                      <div className="category-item-info">
                        <span className="category-item-name">{category}</span>
                        <span className="products-category-badge products-category-badge-local">
                          {isProductCategory(category) ? 'Used by products' : 'Custom filter'}
                        </span>
                      </div>
                      <div className="products-table-actions">
                        <button
                          type="button"
                          className="products-table-edit-action"
                          onClick={() =>
                            handleOpenEditCategory(category, {
                              name: category,
                              isCustom: true,
                              isProduct: isProductCategory(category),
                            })
                          }
                          aria-label={`Edit ${category} category`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="products-table-action"
                          onClick={() =>
                            handleOpenRemoveCategory(category, {
                              name: category,
                              isCustom: true,
                              isProduct: isProductCategory(category),
                            })
                          }
                          aria-label={`Remove ${category} category`}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <PaginationControls
                  currentPage={categoryPage}
                  totalPages={categoryTotalPages}
                  totalItems={filteredCustomCategoryRows.length}
                  pageSize={CATEGORY_PAGE_SIZE}
                  onPageChange={setCategoryPage}
                  summaryLabel="categories"
                />
              </>
            )}
          </div>

          <div className="category-section products-visibility-copy">
            <div className="category-section-header">
              <strong>All Categories</strong>
              <span>Categories currently visible in the catalog.</span>
            </div>

            {filteredVisibleCategoryRows.length === 0 ? (
              <EmptyState
                title={
                  visibleCategoryRows.length === 0
                    ? 'No visible categories'
                    : 'No visible categories match this search'
                }
                description={
                  visibleCategoryRows.length === 0
                    ? 'Categories will appear once products are loaded.'
                    : 'Try a different keyword or clear the search.'
                }
              />
            ) : (
              <>
                <ul className="category-list">
                  {paginatedVisibleCategories.map((category) => (
                    <li key={category.name} className="category-list-item">
                      <div className="category-item-info">
                        <span className="category-item-name">{category.name}</span>
                        <div className="products-category-badges">
                          {category.isProduct ? (
                            <span className="products-category-badge products-category-badge-product">
                              Product
                            </span>
                          ) : null}
                          {category.isCustom ? (
                            <span className="products-category-badge products-category-badge-local">
                              Local
                            </span>
                          ) : null}
                        </div>
                        <span className="products-table-muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                          ({getProductCategoryUsageCount(category.name)} item{getProductCategoryUsageCount(category.name) === 1 ? '' : 's'})
                        </span>
                      </div>
                      <div className="products-table-actions">
                        <button
                          type="button"
                          className="products-table-edit-action"
                          onClick={() => handleOpenEditCategory(category.name, category)}
                          aria-label={`Edit ${category.name} category`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="products-table-action"
                          onClick={() => handleOpenRemoveCategory(category.name, category)}
                          aria-label={`Remove ${category.name} category`}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <PaginationControls
                  currentPage={visibleCategoryPage}
                  totalPages={visibleCategoryTotalPages}
                  totalItems={filteredVisibleCategoryRows.length}
                  pageSize={VISIBLE_CATEGORY_PAGE_SIZE}
                  onPageChange={setVisibleCategoryPage}
                  summaryLabel="visible categories"
                />
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <p className="card-label">Products</p>
          <h2>Catalog Review</h2>
          <p className="supporting-text products-panel-copy">
            Check pricing, branch coverage, and pack sizes.
          </p>

          <div className="products-overview-grid">
            <div className="products-overview-card">
              <span className="products-overview-label">Matching Products</span>
              <strong>{filteredProducts.length}</strong>
              <span className="products-overview-meta">Current results</span>
            </div>
            <div className="products-overview-card">
              <span className="products-overview-label">Branches Covered</span>
              <strong>{visibleProductBranchCount}</strong>
              <span className="products-overview-meta">Shown now</span>
            </div>
            <div className="products-overview-card">
              <span className="products-overview-label">Categories in View</span>
              <strong>{visibleProductCategoryCount}</strong>
              <span className="products-overview-meta">Shown now</span>
            </div>
          </div>

          <div className="products-toolbar">
            <div className="products-toolbar-copy">
              <strong>Search Products</strong>
              <span>Search by product, category, branch, or pack size.</span>
            </div>
            <div className="products-search-shell">
              <label className="products-search-label" htmlFor="product-search">
                Search catalog
              </label>
              <input
                id="product-search"
                type="search"
                className="products-search-input"
                placeholder="Search product, category, branch, or pack size"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <Loader message="Loading products..." />
          ) : loadError ? (
            <EmptyState
              title="Products are currently unavailable"
              description="The product catalog could not be loaded. Please try again later."
            />
          ) : products.length === 0 ? (
            <EmptyState
              title="No products available"
              description="Products will appear here once the catalog is available."
            />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              title="No products match this search"
              description="Refine the search phrase or clear it to return to the full catalog review list."
            />
          ) : (
            <>
              <div className="products-table-shell">
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Branch</th>
                      <th>Unit / Pack Size</th>
                      <th>Price</th>
                    </tr>
                    </thead>
                    <tbody>
                      {paginatedProducts.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="products-product-cell">
                              <strong>{item.name}</strong>
                              <span>
                                {item.unit ? `Pack size: ${item.unit}` : 'Pack size not set'}
                              </span>
                            </div>
                          </td>
                          <td>{item.category}</td>
                          <td>
                            <span className="products-inline-pill">
                              {item.branchName || 'Unassigned Branch'}
                            </span>
                          </td>
                          <td>{item.unit || 'N/A'}</td>
                          <td>
                            <div className="products-price-cell">
                              <strong>{peso(item.price)}</strong>
                              {!item.isSellable && item.availabilityReason ? (
                                <span className="products-price-flag">
                                  {item.availabilityReason}
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                </table>
              </div>

                <PaginationControls
                  currentPage={productPage}
                  totalPages={productTotalPages}
                  totalItems={filteredProducts.length}
                  pageSize={PRODUCT_PREVIEW_PAGE_SIZE}
                  onPageChange={setProductPage}
                  summaryLabel="products"
              />
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={Boolean(categoryEditor)}
        eyebrow="Category Management"
        title="Edit Category"
        description={
          categoryEditor?.isProduct && categoryEditor?.isCustom
            ? 'This rename will update both the active catalog category and the local admin category list.'
            : categoryEditor?.isProduct
              ? 'This rename will update the active catalog category for matching products.'
              : 'This rename will update the local admin category list.'
        }
        onClose={handleCloseEditCategory}
        width="520px"
      >
        <form className="products-modal-form" onSubmit={handleConfirmEditCategory}>
          <label className="products-modal-field">
            <span>Category Name</span>
            <input
              type="text"
              value={categoryEditorName}
              onChange={(event) => {
                if (categoryEditorError) {
                  setCategoryEditorError('')
                }

                setCategoryEditorName(event.target.value)
              }}
              placeholder="Category name"
              aria-invalid={Boolean(categoryEditorError)}
              autoFocus
            />
          </label>

          {categoryEditorError ? (
            <p className="products-modal-error" role="alert">
              {categoryEditorError}
            </p>
          ) : null}

          <div className="products-modal-actions">
            <button
              type="button"
              className="products-secondary-action"
              onClick={handleCloseEditCategory}
              disabled={isSavingCategoryEdit}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isSavingCategoryEdit}
            >
              {isSavingCategoryEdit ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(categoryRemovalTarget)}
        eyebrow="Category Management"
        title="Remove Category"
        description={
          categoryRemovalTarget?.isProduct
            ? 'Matching products will be reassigned to "Uncategorized" instead of being deleted.'
            : 'This removes the local admin category from the frontend list.'
        }
        onClose={handleCloseRemoveCategory}
        width="560px"
      >
        <div className="products-modal-form">
          <p className="products-remove-copy">
            <strong>{categoryRemovalTarget?.name || 'Selected category'}</strong>
            {categoryRemovalTarget?.isProduct
              ? ` is currently used by ${
                  getProductCategoryUsageCount(categoryRemovalTarget.name)
                } product${
                  getProductCategoryUsageCount(categoryRemovalTarget.name) === 1
                    ? ''
                    : 's'
                }.`
              : ' is currently stored only in the local admin category list.'}
          </p>

          {categoryRemovalError ? (
            <p className="products-modal-error" role="alert">
              {categoryRemovalError}
            </p>
          ) : null}

          <div className="products-modal-actions">
            <button
              type="button"
              className="products-secondary-action"
              onClick={handleCloseRemoveCategory}
              disabled={isRemovingCategory}
            >
              Cancel
            </button>
            <button
              type="button"
              className="products-table-action"
              onClick={handleConfirmRemoveCategory}
              disabled={isRemovingCategory}
            >
              {isRemovingCategory ? 'Removing...' : 'Remove Category'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  )
}

export default ProductsPage
