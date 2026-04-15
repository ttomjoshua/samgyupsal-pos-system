import EmptyState from '../common/EmptyState'
import StatusBadge from '../common/StatusBadge'
import { shortDate } from '../../utils/formatters'

function InventoryTable({
  items,
  onStockIn,
  onEdit,
  onAdjustStock,
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
            <th>Unit</th>
            <th>Expiry</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const lowStock =
              Number(item.stock_quantity) <= Number(item.reorder_level)
            const nearExpiry =
              item.days_to_expiry != null && Number(item.days_to_expiry) <= 30

            let statusText = 'Normal'
            let statusVariant = 'success'

            if (lowStock && nearExpiry) {
              statusText = 'Near expiry'
              statusVariant = 'danger'
            } else if (lowStock) {
              statusText = 'Low stock'
              statusVariant = 'warning'
            } else if (nearExpiry) {
              statusText = 'Near expiry'
              statusVariant = 'danger'
            }

            return (
              <tr key={item.id}>
                <td>{item.product_name}</td>
                <td>{item.category_name}</td>
                <td>{item.stock_quantity}</td>
                <td>{item.unit}</td>
                <td>{shortDate(item.expiry_date)}</td>
                <td>
                  <StatusBadge text={statusText} variant={statusVariant} />
                </td>
                <td>
                  <div className="inventory-actions">
                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => onStockIn?.(item)}
                    >
                      Stock In
                    </button>
                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => onEdit?.(item)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => onAdjustStock?.(item)}
                    >
                      Adjust Stock
                    </button>
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
