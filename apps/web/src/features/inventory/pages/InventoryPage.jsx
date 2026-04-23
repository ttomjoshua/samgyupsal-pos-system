import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Loader from '../../../shared/components/common/Loader'
import EmptyState from '../../../shared/components/common/EmptyState'
import InventoryTable from '../components/InventoryTable'
import NoticeBanner from '../../../shared/components/common/NoticeBanner'
import PaginationControls from '../../../shared/components/common/PaginationControls'
import Modal from '../../../shared/components/ui/Modal'
import SelectMenu from '../../../shared/components/ui/SelectMenu'
import {
  getBranches,
  getCachedBranches,
} from '../../branches/services/branchService'
import useAuth from '../../auth/hooks/useAuth'
import useSessionStorageState from '../../../shared/hooks/useSessionStorageState'
import {
  createInventoryItem,
  getCachedInventoryItems,
  getInventoryItems,
  hasInventoryCatalogConflict,
  removeInventoryItem,
  updateInventoryItem,
  updateInventoryStock,
} from '../services/inventoryService'
import {
  INVENTORY_FILTER_ALL,
  INVENTORY_FILTER_EXPIRY_DATE,
  INVENTORY_FILTER_LOW_STOCK,
  resolveInventoryFilterResults,
} from '../utils/inventoryFilters'
import {
  canAdjustInventoryStock,
  canManageInventoryCatalog,
  isAdminUser,
} from '../../../shared/utils/permissions'
import {
  getFirstValidationError,
  validateInventoryForm,
  validateInventoryQuantityAction,
} from '../../../shared/utils/validation'
import '../styles/inventory.css'

const INITIAL_PRODUCT_FORM = {
  product_name: '',
  category_name: '',
  price: '',
  stock_quantity: '',
  unit: '',
  expiry_date: '',
  reorder_level: '10',
}

const INVENTORY_PAGE_SIZE = 10
const INVENTORY_PAGE_STATE_KEY = 'page-state:inventory'

function InventoryPage() {
  const { user } = useAuth()
  const inventoryRequestRef = useRef(0)
  const inventoryLoadScopeRef = useRef('')
  const isAdminInventoryView = isAdminUser(user)
  const canEditCatalog = canManageInventoryCatalog(user)
  const canUpdateStock = canAdjustInventoryStock(user)
  const [branchOptions, setBranchOptions] = useState(() => getCachedBranches() || [])
  const [isBranchLoading, setIsBranchLoading] = useState(
    () => (getCachedBranches() || []).length === 0,
  )
  const [branchLoadError, setBranchLoadError] = useState('')
  const [inventoryViewState, setInventoryViewState] = useSessionStorageState(
    INVENTORY_PAGE_STATE_KEY,
    () => ({
      activeBranchId: user?.branchId != null ? String(user.branchId) : '',
      activeFilter: INVENTORY_FILTER_ALL,
      activeCategory: INVENTORY_FILTER_ALL,
      currentPage: 1,
    }),
  )
  const initialInventoryResponse = getCachedInventoryItems(
    isAdminInventoryView ? {} : { branchId: user?.branchId ?? null },
  )
  const [inventoryItems, setInventoryItems] = useState(
    () => initialInventoryResponse?.items || initialInventoryResponse || [],
  )
  const [isLoading, setIsLoading] = useState(() => !initialInventoryResponse)
  const [productDialogMode, setProductDialogMode] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [formData, setFormData] = useState(INITIAL_PRODUCT_FORM)
  const [formError, setFormError] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackTone, setFeedbackTone] = useState('success')
  const [loadError, setLoadError] = useState('')
  const [quantityDialog, setQuantityDialog] = useState(null)
  const [quantityValue, setQuantityValue] = useState('')
  const [quantityError, setQuantityError] = useState('')
  const [removeDialogItem, setRemoveDialogItem] = useState(null)
  const [removeError, setRemoveError] = useState('')
  const [isRemoving, setIsRemoving] = useState(false)
  const activeBranchId =
    inventoryViewState?.activeBranchId ??
    (user?.branchId != null ? String(user.branchId) : '')
  const activeFilter = inventoryViewState?.activeFilter || INVENTORY_FILTER_ALL
  const activeCategory = inventoryViewState?.activeCategory || INVENTORY_FILTER_ALL
  const currentPage = Math.max(1, Number(inventoryViewState?.currentPage || 1))
  const updateInventoryViewState = useCallback((patch) => {
    setInventoryViewState((currentState) => ({
      ...(currentState || {}),
      ...(typeof patch === 'function' ? patch(currentState || {}) : patch),
    }))
  }, [setInventoryViewState])

  const activeBranch = useMemo(
    () =>
      branchOptions.find((branch) => String(branch.id) === String(activeBranchId)) ||
      null,
    [activeBranchId, branchOptions],
  )

  useEffect(() => {
    let isMounted = true

    const loadBranchOptions = async () => {
      try {
        setIsBranchLoading(true)
        const branches = await getBranches()

        if (!isMounted) {
          return
        }

        setBranchOptions(branches)
        setBranchLoadError('')
        updateInventoryViewState((currentState) => {
          const currentBranchId = currentState?.activeBranchId ?? ''

          if (user?.branchId) {
            return {
              ...currentState,
              activeBranchId: String(user.branchId),
            }
          }

          const hasCurrentBranch = branches.some(
            (branch) => String(branch.id) === String(currentBranchId),
          )

          if (hasCurrentBranch) {
            return currentState
          }

          return {
            ...currentState,
            activeBranchId: branches[0]?.id != null ? String(branches[0].id) : '',
          }
        })
      } catch (error) {
        console.error('Failed to load inventory branches:', error)

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

    loadBranchOptions()

    return () => {
      isMounted = false
    }
  }, [updateInventoryViewState, user?.branchId])

  useEffect(() => {
    if (!user?.branchId) {
      return
    }

    updateInventoryViewState((currentState) => (
      currentState?.activeBranchId === String(user.branchId)
        ? currentState
        : {
            ...currentState,
            activeBranchId: String(user.branchId),
          }
    ))
  }, [updateInventoryViewState, user?.branchId])

  const loadInventory = useCallback(async () => {
    const requestId = inventoryRequestRef.current + 1
    inventoryRequestRef.current = requestId

    try {
      const inventoryScope = isAdminInventoryView
        ? {}
        : { branchId: user?.branchId ?? null }
      const data = await getInventoryItems(inventoryScope)

      if (requestId !== inventoryRequestRef.current) {
        return
      }

      setInventoryItems(data.items || data)
      setLoadError('')
    } catch (error) {
      if (requestId !== inventoryRequestRef.current) {
        return
      }

      console.error('Failed to load inventory records:', error)
      setInventoryItems([])
      setLoadError(
        error.response?.data?.message ||
          'Inventory records could not be loaded right now.',
      )
    } finally {
      if (requestId === inventoryRequestRef.current) {
        setIsLoading(false)
      }
    }
  }, [isAdminInventoryView, user?.branchId])

  useEffect(() => {
    if (!activeBranchId) {
      return
    }

    const loadScopeKey = isAdminInventoryView
      ? 'admin'
      : `employee:${String(user?.branchId ?? '')}`

    if (inventoryLoadScopeRef.current === loadScopeKey) {
      return
    }

    inventoryLoadScopeRef.current = loadScopeKey
    if (!getCachedInventoryItems(isAdminInventoryView ? {} : { branchId: user?.branchId ?? null })) {
      setIsLoading(true)
    }
    void loadInventory()
  }, [activeBranchId, isAdminInventoryView, loadInventory, user?.branchId])

  const inventoryFilterResults = useMemo(
    () => resolveInventoryFilterResults({
      items: inventoryItems,
      branchId: isAdminInventoryView ? activeBranchId : '',
      status: activeFilter,
      category: activeCategory,
    }),
    [activeBranchId, activeCategory, activeFilter, inventoryItems, isAdminInventoryView],
  )

  useEffect(() => {
    if (activeCategory !== inventoryFilterResults.resolvedCategory) {
      updateInventoryViewState({
        activeCategory: inventoryFilterResults.resolvedCategory,
      })
    }
  }, [activeCategory, inventoryFilterResults.resolvedCategory, updateInventoryViewState])

  const effectiveActiveCategory = inventoryFilterResults.resolvedCategory
  const filteredItems = inventoryFilterResults.filteredItems

  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / INVENTORY_PAGE_SIZE),
  )

  useEffect(() => {
    updateInventoryViewState((currentState) => (
      Number(currentState?.currentPage || 1) === 1
        ? currentState
        : {
            ...currentState,
            currentPage: 1,
          }
    ))
  }, [activeBranchId, activeCategory, activeFilter, updateInventoryViewState])

  const totalBranchItems = inventoryFilterResults.branchItems.length
  const filterCategoryOptions = inventoryFilterResults.categoryOptions
  const branchCategorySuggestions = inventoryFilterResults.categoryOptions
  const selectedBranchId =
    activeBranchId === '' ? null : Number(activeBranchId)

  useEffect(() => {
    if (currentPage > totalPages) {
      updateInventoryViewState({
        currentPage: totalPages,
      })
    }
  }, [currentPage, totalPages, updateInventoryViewState])

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * INVENTORY_PAGE_SIZE
    return filteredItems.slice(startIndex, startIndex + INVENTORY_PAGE_SIZE)
  }, [currentPage, filteredItems])

  const handleOpenAddProduct = () => {
    if (!canEditCatalog) {
      setFeedbackTone('warning')
      setFeedbackMessage(
        'Employee accounts can update stock quantities only for their assigned branch.',
      )
      return
    }

    setFormError('')
    setFeedbackMessage('')
    setFormData(INITIAL_PRODUCT_FORM)
    setSelectedItem(null)
    setProductDialogMode('add')
  }

  const handleCloseProductDialog = () => {
    setFormError('')
    setSelectedItem(null)
    setProductDialogMode(null)
  }

  const handleOpenEditProduct = (item) => {
    if (!canEditCatalog) {
      setFeedbackTone('warning')
      setFeedbackMessage(
        'Employee accounts cannot edit product details. Use Stock In or Adjust Stock instead.',
      )
      return
    }

    setFormError('')
    setFeedbackMessage('')
    setSelectedItem(item)
    setFormData({
      product_name: item.product_name,
      category_name: item.category_name,
      price: String(item.price ?? ''),
      stock_quantity: String(item.stock_quantity),
      unit: item.unit,
      expiry_date: item.expiry_date,
      reorder_level: String(item.reorder_level),
    })
    setProductDialogMode('edit')
  }

  const handleFieldChange = (event) => {
    const { name, value } = event.target

    if (formError) {
      setFormError('')
    }

    setFormData((previousForm) => ({
      ...previousForm,
      [name]: value,
    }))
  }

  const handleSaveProduct = async (event) => {
    event.preventDefault()

    if (!canEditCatalog) {
      setFormError('Only administrator accounts can add or edit product records.')
      return
    }

    const validation = validateInventoryForm(formData)

    if (!validation.isValid) {
      setFormError(getFirstValidationError(validation.errors))
      return
    }

    if (
      hasInventoryCatalogConflict(
        {
          ...validation.sanitizedData,
          branch_id: selectedBranchId,
        },
        inventoryItems,
        productDialogMode === 'edit' ? selectedItem?.id : null,
      )
      ) {
        setFormError(
        'A product with the same category, name, and pack size already exists in this branch. Use Stock In or Edit the existing record instead.',
        )
        return
      }

    try {
      if (productDialogMode === 'edit' && selectedItem) {
        const updatedItem = await updateInventoryItem(selectedItem.id, {
          ...validation.sanitizedData,
          branch_id: selectedBranchId,
          branch_name: activeBranch?.name || selectedItem.branch_name || '',
        })

        setInventoryItems((previousItems) =>
          previousItems.map((item) =>
            item.id === selectedItem.id ? updatedItem : item,
          ),
        )
        setFeedbackTone('success')
        setFeedbackMessage(`${updatedItem.product_name} was updated.`)
      } else {
        const createdItem = await createInventoryItem(
          {
            ...validation.sanitizedData,
            branch_id: selectedBranchId,
            branch_name: activeBranch?.name || '',
          },
          inventoryItems,
        )

        setInventoryItems((previousItems) => [createdItem, ...previousItems])
        setFeedbackTone('success')
        setFeedbackMessage(
          `${createdItem.product_name} was added to ${activeBranch?.name || 'the selected branch'}.`,
        )
      }
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          error.message ||
          'Unable to save this product.',
      )
      return
    }

    updateInventoryViewState({
      activeFilter: INVENTORY_FILTER_ALL,
    })
    setFormError('')
    setFormData(INITIAL_PRODUCT_FORM)
    setSelectedItem(null)
    setProductDialogMode(null)
  }

  const handleOpenQuantityDialog = (type, item) => {
    setFeedbackMessage('')
    setQuantityError('')
    setSelectedItem(item)
    setQuantityValue('')
    setQuantityDialog(type)
  }

  const handleCloseQuantityDialog = () => {
    setQuantityDialog(null)
    setSelectedItem(null)
    setQuantityValue('')
    setQuantityError('')
  }

  const handleOpenRemoveDialog = (item) => {
    if (!canEditCatalog) {
      setFeedbackTone('warning')
      setFeedbackMessage(
        'Employee accounts cannot remove products from inventory.',
      )
      return
    }

    setFeedbackMessage('')
    setRemoveError('')
    setSelectedItem(item)
    setRemoveDialogItem(item)
  }

  const handleCloseRemoveDialog = () => {
    setRemoveDialogItem(null)
    setSelectedItem(null)
    setRemoveError('')
    setIsRemoving(false)
  }

  const handleSubmitQuantityDialog = async (event) => {
    event.preventDefault()

    const validation = validateInventoryQuantityAction({
      selectedItem,
      quantityValue,
      mode: quantityDialog,
    })

    if (!validation.isValid) {
      setQuantityError(getFirstValidationError(validation.errors))
      return
    }

    const parsedAmount = validation.sanitizedAmount

    try {
      const updatedItem = await updateInventoryStock(selectedItem.id, parsedAmount, {
        mode: quantityDialog,
      })

      setInventoryItems((previousItems) =>
        previousItems.map((item) =>
          item.id === selectedItem.id ? updatedItem : item,
        ),
      )

      if (quantityDialog === 'stock-in') {
        setFeedbackMessage(
          `${selectedItem.product_name} increased by ${parsedAmount} unit${
            parsedAmount === 1 ? '' : 's'
          }.`,
        )
      } else {
        setFeedbackMessage(
          `${selectedItem.product_name} stock is now ${updatedItem.stock_quantity}.`,
        )
      }

      setFeedbackTone('success')
      handleCloseQuantityDialog()
    } catch (error) {
      setQuantityError(
        error.response?.data?.message ||
          error.message ||
          'Unable to update this stock quantity.',
      )
    }
  }

  const handleConfirmRemove = async () => {
    if (!removeDialogItem) {
      return
    }

    if (!canEditCatalog) {
      setRemoveError('Only administrator accounts can remove product records.')
      return
    }

    try {
      setIsRemoving(true)
      const removedItem = await removeInventoryItem(removeDialogItem.id)

      setInventoryItems((previousItems) =>
        previousItems.filter((item) => item.id !== removeDialogItem.id),
      )
      setFeedbackTone('success')
      setFeedbackMessage(
        `${removedItem.product_name} was removed from ${
          activeBranch?.name || removeDialogItem.branch_name || 'the selected branch'
        } inventory.`,
      )
      handleCloseRemoveDialog()
    } catch (error) {
      setRemoveError(
        error.response?.data?.message ||
          error.message ||
          'Unable to remove this inventory item.',
      )
      setIsRemoving(false)
    }
  }

  if (isBranchLoading && branchOptions.length === 0) {
    return <Loader message="Loading branch scope..." />
  }

  if (!isBranchLoading && !activeBranchId) {
    return (
      <EmptyState
        title="No branch scope available"
        description="Add at least one branch before opening the inventory screen."
      />
    )
  }

  return (
    <section className="inventory-page">
      <div className="inventory-topbar">
        <div className="inventory-title-block">
          <p className="eyebrow">Inventory</p>
          <h1>Inventory</h1>
          <p className="supporting-text">
            {isAdminInventoryView
              ? 'Manage stock, expiry dates, and branch inventory.'
              : 'Update stock quantities for your assigned branch and monitor low-stock items.'}
          </p>
        </div>

        <div className="inventory-meta-grid">
            <article className="inventory-meta-card">
              <span className="meta-label">Active Branch</span>
              <strong className="meta-primary">
                {activeBranch?.name || 'Branch pending'}
              </strong>
              <span className="meta-secondary">
                {user?.branchId
                  ? 'Assigned branch for your account.'
                  : 'Selected branch for stock management.'}
              </span>
            </article>

          <article className="inventory-meta-card">
            <span className="meta-label">Visible Products</span>
            <strong className="meta-primary">{filteredItems.length}</strong>
            <span className="meta-secondary">
              Based on current filters.
            </span>
          </article>

            {isAdminInventoryView ? (
              <article className="inventory-meta-card inventory-meta-card--action">
                <span className="meta-label">Catalog Action</span>
                <strong className="meta-primary">Add Product</strong>
                <span className="meta-secondary">
                  Add a new product to this branch.
                </span>
                <button
                  type="button"
                  className="inventory-primary-action"
                  onClick={handleOpenAddProduct}
                  disabled={!activeBranchId}
                >
                  Add Product
                </button>
              </article>
            ) : (
              <article className="inventory-meta-card">
                <span className="meta-label">Stock Permission</span>
                <strong className="meta-primary">Stock Only</strong>
                <span className="meta-secondary">
                  Employee accounts can use Stock In and Adjust Stock for their assigned branch.
                </span>
              </article>
            )}
          </div>
        </div>

      {loadError ? (
        <NoticeBanner
          variant="error"
          title="Inventory data unavailable"
          message={loadError}
        />
      ) : null}

      {branchLoadError ? (
        <NoticeBanner
          variant="error"
          title="Branch scope unavailable"
          message={branchLoadError}
        />
      ) : null}

      {feedbackMessage ? (
        <NoticeBanner
          variant={feedbackTone}
          title="Inventory update"
          message={feedbackMessage}
        />
      ) : null}

      <div className="panel inventory-toolbar-panel">
          <div className="inventory-toolbar-heading">
            <div>
              <p className="card-label">Inventory Controls</p>
              <h2>Current Stock</h2>
            </div>

          <p className="inventory-result-copy">
            {activeBranch ? `Branch: ${activeBranch.name} | ` : ''}
            Showing <strong>{filteredItems.length}</strong>
            {totalBranchItems !== filteredItems.length ? ` of ${totalBranchItems}` : ''}
            {' '}product
            {filteredItems.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="inventory-toolbar">
          <div className="inventory-filter-group">
            {user?.branchId ? (
              <div className="inventory-category-control inventory-category-control--locked">
                <span>Branch</span>
                <strong>{activeBranch?.name || user?.branchName || 'Assigned branch'}</strong>
              </div>
            ) : (
              <label className="inventory-category-control">
                <span>Branch</span>
                <SelectMenu
                  name="activeBranch"
                  value={activeBranchId}
                  onChange={(event) =>
                    updateInventoryViewState({
                      activeBranchId: String(event.target.value),
                    })
                  }
                  disabled={isLoading}
                  options={branchOptions.map((branch) => ({
                    value: String(branch.id),
                    label: branch.name,
                  }))}
                />
              </label>
            )}

            <button
              type="button"
              className={
                activeFilter === INVENTORY_FILTER_ALL
                  ? 'inventory-filter active'
                  : 'inventory-filter'
              }
              onClick={() =>
                updateInventoryViewState({
                  activeFilter: INVENTORY_FILTER_ALL,
                })
              }
              disabled={isLoading}
            >
              All Items
            </button>
            <button
              type="button"
              className={
                activeFilter === INVENTORY_FILTER_LOW_STOCK
                  ? 'inventory-filter active'
                  : 'inventory-filter'
              }
              onClick={() =>
                updateInventoryViewState({
                  activeFilter: INVENTORY_FILTER_LOW_STOCK,
                })
              }
              disabled={isLoading}
            >
              Low Stock
            </button>
            <button
              type="button"
              className={
                activeFilter === INVENTORY_FILTER_EXPIRY_DATE
                  ? 'inventory-filter active'
                  : 'inventory-filter'
              }
              onClick={() =>
                updateInventoryViewState({
                  activeFilter: INVENTORY_FILTER_EXPIRY_DATE,
                })
              }
              disabled={isLoading}
            >
              Expiry Dates
            </button>
            <label className="inventory-category-control inventory-category-control--category-filter">
              <span>Category</span>
              <SelectMenu
                name="activeCategory"
                value={effectiveActiveCategory}
                onChange={(event) =>
                  updateInventoryViewState({
                    activeCategory: event.target.value,
                  })
                }
                disabled={isLoading || filterCategoryOptions.length === 0}
                options={[
                  { value: INVENTORY_FILTER_ALL, label: 'All Categories' },
                  ...filterCategoryOptions.map((category) => ({
                    value: category,
                    label: category,
                  })),
                ]}
              />
            </label>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Loader message="Loading inventory..." />
      ) : loadError ? (
        <EmptyState
          title="Inventory records are unavailable"
          description="The current inventory list could not be loaded. Check the data source and try again."
        />
      ) : (
        <>
          <InventoryTable
            items={paginatedItems}
            canEditCatalog={canEditCatalog}
            canUpdateStock={canUpdateStock}
            onStockIn={(item) => handleOpenQuantityDialog('stock-in', item)}
            onEdit={handleOpenEditProduct}
            onAdjustStock={(item) => handleOpenQuantityDialog('adjust-stock', item)}
            onRemove={handleOpenRemoveDialog}
          />

          {filteredItems.length > 0 ? (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredItems.length}
              pageSize={INVENTORY_PAGE_SIZE}
              onPageChange={(page) =>
                updateInventoryViewState({
                  currentPage: page,
                })
              }
              summaryLabel="products"
            />
          ) : null}
        </>
      )}

      <Modal
        isOpen={Boolean(productDialogMode)}
        eyebrow="Product"
        title={productDialogMode === 'edit' ? 'Edit Product' : 'Add Product'}
        description={
          productDialogMode === 'edit'
            ? 'Update the product details for this branch.'
            : 'Add a product to the selected branch.'
        }
        onClose={handleCloseProductDialog}
      >
        <form className="inventory-form" onSubmit={handleSaveProduct}>
          <label className="inventory-field">
            <span>Product Name</span>
            <input
              type="text"
              name="product_name"
              value={formData.product_name}
              onChange={handleFieldChange}
              placeholder="Kimchi"
              aria-invalid={Boolean(formError)}
            />
          </label>

          <label className="inventory-field">
            <span>Category</span>
            <SelectMenu
              name="category_name"
              value={formData.category_name}
              onChange={handleFieldChange}
              aria-invalid={Boolean(formError)}
              placeholder="Select a category"
              options={[
                { value: '', label: 'Select a category' },
                ...branchCategorySuggestions.map((category) => ({
                  value: category,
                  label: category
                }))
              ]}
            />
          </label>

          <label className="inventory-field">
            <span>Stock Quantity</span>
            <input
              type="number"
              min="0"
              name="stock_quantity"
              value={formData.stock_quantity}
              onChange={handleFieldChange}
              placeholder="25"
              aria-invalid={Boolean(formError)}
            />
          </label>

          <label className="inventory-field">
            <span>Price</span>
            <input
              type="number"
              min="0"
              step="0.01"
              name="price"
              value={formData.price}
              onChange={handleFieldChange}
              placeholder="109"
              aria-invalid={Boolean(formError)}
            />
          </label>

          <label className="inventory-field">
            <span>Unit / Pack Size</span>
            <input
              type="text"
              name="unit"
              value={formData.unit}
              onChange={handleFieldChange}
              placeholder="pack"
              aria-invalid={Boolean(formError)}
            />
          </label>

          <label className="inventory-field">
            <span>Expiry Date</span>
            <input
              type="date"
              name="expiry_date"
              value={formData.expiry_date}
              onChange={handleFieldChange}
              aria-invalid={Boolean(formError)}
            />
          </label>

          <label className="inventory-field">
            <span>Reorder Level</span>
            <input
              type="number"
              min="0"
              name="reorder_level"
              value={formData.reorder_level}
              onChange={handleFieldChange}
              placeholder="10"
              aria-invalid={Boolean(formError)}
            />
          </label>

          {formError ? (
            <p className="inventory-form-error" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="inventory-form-actions">
            <button
              type="button"
              className="inventory-secondary-action"
              onClick={handleCloseProductDialog}
            >
              Cancel
            </button>
            <button type="submit" className="inventory-primary-action">
              {productDialogMode === 'edit' ? 'Save Changes' : 'Save Product'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(quantityDialog)}
        eyebrow="Inventory Action"
        title={quantityDialog === 'stock-in' ? 'Stock In Item' : 'Adjust Stock'}
        description={`${selectedItem?.product_name || 'Selected item'} currently has ${
          selectedItem?.stock_quantity ?? 0
        } in stock.`}
        onClose={handleCloseQuantityDialog}
        width="520px"
      >
        <form
          className="inventory-form inventory-action-form"
          onSubmit={handleSubmitQuantityDialog}
        >
          <label className="inventory-field">
              <span>
                {quantityDialog === 'stock-in'
                  ? 'Quantity to Add'
                  : 'New Stock Quantity'}
              </span>
            <input
              type="number"
              step="1"
              name="quantityValue"
              value={quantityValue}
              onChange={(event) => {
                if (quantityError) {
                  setQuantityError('')
                }

                setQuantityValue(event.target.value)
              }}
              placeholder={quantityDialog === 'stock-in' ? '5' : '12'}
              aria-invalid={Boolean(quantityError)}
            />
          </label>

          {quantityError ? (
            <p className="inventory-form-error" role="alert">
              {quantityError}
            </p>
          ) : null}

          <div className="inventory-form-actions">
            <button
              type="button"
              className="inventory-secondary-action"
              onClick={handleCloseQuantityDialog}
            >
              Cancel
            </button>
            <button type="submit" className="inventory-primary-action">
              {quantityDialog === 'stock-in' ? 'Apply Stock In' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(removeDialogItem)}
        eyebrow="Inventory Action"
        title="Remove Product"
        description={`This will permanently remove ${
          removeDialogItem?.product_name || 'the selected product'
        } from the current branch inventory.`}
        onClose={handleCloseRemoveDialog}
        width="520px"
      >
        <div className="inventory-form inventory-action-form">
          <p className="inventory-remove-copy">
            This action removes the product record itself, including its current stock
            quantity, from the inventory list.
          </p>

          {removeError ? (
            <p className="inventory-form-error" role="alert">
              {removeError}
            </p>
          ) : null}

          <div className="inventory-form-actions">
            <button
              type="button"
              className="inventory-secondary-action"
              onClick={handleCloseRemoveDialog}
              disabled={isRemoving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inventory-danger-action"
              onClick={handleConfirmRemove}
              disabled={isRemoving}
            >
              {isRemoving ? 'Removing...' : 'Remove Product'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  )
}

export default InventoryPage
