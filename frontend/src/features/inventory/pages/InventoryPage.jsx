import { useCallback, useEffect, useMemo, useState } from 'react'
import Loader from '../../../shared/components/common/Loader'
import EmptyState from '../../../shared/components/common/EmptyState'
import InventoryTable from '../components/InventoryTable'
import NoticeBanner from '../../../shared/components/common/NoticeBanner'
import PaginationControls from '../../../shared/components/common/PaginationControls'
import Modal from '../../../shared/components/ui/Modal'
import { getBranches } from '../../branches/services/branchService'
import {
  createInventoryItem,
  getInventoryItems,
  hasInventoryCatalogConflict,
  isLowStock,
  isNearExpiry,
  removeInventoryItem,
  updateInventoryItem,
  updateInventoryStock,
} from '../services/inventoryService'
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

function InventoryPage() {
  const [branchOptions, setBranchOptions] = useState([])
  const [isBranchLoading, setIsBranchLoading] = useState(true)
  const [branchLoadError, setBranchLoadError] = useState('')
  const [inventoryItems, setInventoryItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeBranchId, setActiveBranchId] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [activeCategory, setActiveCategory] = useState('all')
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
  const [currentPage, setCurrentPage] = useState(1)

  const activeBranch = useMemo(
    () =>
      branchOptions.find((branch) => Number(branch.id) === Number(activeBranchId)) ||
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
        setActiveBranchId((currentBranchId) => {
          const hasCurrentBranch = branches.some(
            (branch) => Number(branch.id) === Number(currentBranchId),
          )

          if (hasCurrentBranch) {
            return currentBranchId
          }

          return branches[0]?.id || ''
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
  }, [])

  const loadInventory = useCallback(async (branchId) => {
    try {
      const data = await getInventoryItems({ branchId })
      setInventoryItems(data.items || data)
      setLoadError('')
    } catch (error) {
      console.error('Failed to load inventory records:', error)
      setInventoryItems([])
      setLoadError(
        error.response?.data?.message ||
          'Inventory records could not be loaded right now.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!activeBranchId) {
      return
    }

    setIsLoading(true)
    void loadInventory(activeBranchId)
  }, [activeBranchId, loadInventory])

  const categorySuggestions = useMemo(
    () => [...new Set(inventoryItems.map((item) => item.category_name).filter(Boolean))],
    [inventoryItems],
  )

  const filteredItems = inventoryItems.filter((item) => {
    const matchesStatusFilter =
      activeFilter === 'all'
        ? true
        : activeFilter === 'low-stock'
          ? isLowStock(item)
          : isNearExpiry(item)

    const matchesCategory =
      activeCategory === 'all' || item.category_name === activeCategory

    return matchesStatusFilter && matchesCategory
  })

  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / INVENTORY_PAGE_SIZE),
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [activeBranchId, activeCategory, activeFilter])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * INVENTORY_PAGE_SIZE
    return filteredItems.slice(startIndex, startIndex + INVENTORY_PAGE_SIZE)
  }, [currentPage, filteredItems])

  const handleOpenAddProduct = () => {
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

    const validation = validateInventoryForm(formData)

    if (!validation.isValid) {
      setFormError(getFirstValidationError(validation.errors))
      return
    }

    if (
      hasInventoryCatalogConflict(
        {
          ...validation.sanitizedData,
          branch_id: activeBranchId,
        },
        inventoryItems,
        productDialogMode === 'edit' ? selectedItem?.id : null,
      )
    ) {
      setFormError(
        'A product with the same category, name, and unit already exists in this branch. Use Stock In or Edit the existing record instead.',
      )
      return
    }

    try {
      if (productDialogMode === 'edit' && selectedItem) {
        const updatedItem = await updateInventoryItem(selectedItem.id, {
          ...validation.sanitizedData,
          branch_id: activeBranchId,
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
            branch_id: activeBranchId,
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

    setActiveFilter('all')
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
      const updatedItem = await updateInventoryStock(selectedItem.id, parsedAmount)

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
          `${selectedItem.product_name} stock was adjusted to ${updatedItem.stock_quantity}.`,
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
            Control stock levels, expiry risk, and branch inventory actions from one workspace.
          </p>
        </div>

        <div className="inventory-meta-grid">
          <article className="inventory-meta-card">
            <span className="meta-label">Active Branch</span>
            <strong className="meta-primary">
              {activeBranch?.name || 'Branch pending'}
            </strong>
            <span className="meta-secondary">
              Selected branch for stock management.
            </span>
          </article>

          <article className="inventory-meta-card">
            <span className="meta-label">Visible Products</span>
            <strong className="meta-primary">{filteredItems.length}</strong>
            <span className="meta-secondary">
              Based on current filters.
            </span>
          </article>

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
            <h2>Filter Current Branch View</h2>
          </div>

          <p className="inventory-result-copy">
            {activeBranch ? `Branch: ${activeBranch.name} | ` : ''}
            Showing <strong>{filteredItems.length}</strong> product
            {filteredItems.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="inventory-toolbar">
          <div className="inventory-filter-group">
            <label className="inventory-category-control">
              <span>Branch</span>
              <select
                name="activeBranch"
                value={activeBranchId}
                onChange={(event) => setActiveBranchId(Number(event.target.value))}
              >
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className={
                activeFilter === 'all'
                  ? 'inventory-filter active'
                  : 'inventory-filter'
              }
              onClick={() => setActiveFilter('all')}
            >
              All Items
            </button>
            <button
              type="button"
              className={
                activeFilter === 'low-stock'
                  ? 'inventory-filter active'
                  : 'inventory-filter'
              }
              onClick={() => setActiveFilter('low-stock')}
            >
              Low Stock
            </button>
            <button
              type="button"
              className={
                activeFilter === 'near-expiry'
                  ? 'inventory-filter active'
                  : 'inventory-filter'
              }
              onClick={() => setActiveFilter('near-expiry')}
            >
              Near Expiry
            </button>
            <label className="inventory-category-control">
              <span>Category</span>
              <select
                name="activeCategory"
                value={activeCategory}
                onChange={(event) => setActiveCategory(event.target.value)}
              >
                <option value="all">All Categories</option>
                {categorySuggestions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
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
              onPageChange={setCurrentPage}
              summaryLabel="products"
            />
          ) : null}
        </>
      )}

      <Modal
        isOpen={Boolean(productDialogMode)}
        eyebrow="Quick Product Entry"
        title={productDialogMode === 'edit' ? 'Edit Product' : 'Add Product'}
        description={
          productDialogMode === 'edit'
            ? 'Update the product details and refresh the branch inventory table immediately.'
            : 'Create a branch-specific inventory record so the inventory list updates immediately.'
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
            <select
              name="category_name"
              value={formData.category_name}
              onChange={handleFieldChange}
              aria-invalid={Boolean(formError)}
            >
              <option value="">Select a category</option>
              {categorySuggestions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
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
            <span>Unit</span>
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
                : 'Adjustment Amount (+ or -)'}
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
              placeholder={quantityDialog === 'stock-in' ? '5' : '-2'}
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
