import EmptyState from '../../../shared/components/common/EmptyState'
import StatusBadge from '../../../shared/components/common/StatusBadge'
import { getInventoryStatus } from '../services/inventoryService'
import { shortDate } from '../../../shared/utils/formatters'
import {
  getInventoryCategoryLabel,
  getInventoryCategoryValue,
} from '../utils/inventoryFilters'

function InventoryTable({
  items,
  canEditCatalog = true,
  canUpdateStock = true,
  onStockIn,
  onEdit,
  onAdjustStock,
  onRemove,
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No inventory records match this filter"
        description="Try switching the filter to view more stocked or expiring items."
      />
    )
  }

  return (
    <div className="inventory-table-shell">
      <table className="inventory-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Stock</th>
            <th>Unit / Pack Size</th>
            <th>Expiry</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const status = getInventoryStatus(item)

            return (
              <tr key={item.id}>
                <td>{item.product_name}</td>
                <td>{getInventoryCategoryLabel(getInventoryCategoryValue(item))}</td>
                <td>{item.stock_quantity}</td>
                <td>{item.unit}</td>
                <td>{shortDate(item.expiry_date)}</td>
                <td>
                  <StatusBadge text={status.label} variant={status.tone} />
                </td>
                <td>
                  <div className="inventory-actions">
                    {canUpdateStock ? (
                      <button
                        type="button"
                        className="table-action-button"
                        onClick={() => onStockIn?.(item)}
                      >
                        Stock In
                      </button>
                    ) : null}
                    {canEditCatalog ? (
                      <button
                        type="button"
                        className="table-action-button"
                        onClick={() => onEdit?.(item)}
                      >
                        Edit
                      </button>
                    ) : null}
                    {canUpdateStock ? (
                      <button
                        type="button"
                        className="table-action-button"
                        onClick={() => onAdjustStock?.(item)}
                      >
                        Adjust Stock
                      </button>
                    ) : null}
                    {canEditCatalog ? (
                      <button
                        type="button"
                        className="table-action-button table-action-button-danger"
                        onClick={() => onRemove?.(item)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default InventoryTable
