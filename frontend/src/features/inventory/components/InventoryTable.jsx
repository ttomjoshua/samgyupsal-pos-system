import EmptyState from '../../../shared/components/common/EmptyState'
import StatusBadge from '../../../shared/components/common/StatusBadge'
import { getInventoryStatus } from '../services/inventoryService'
import { shortDate } from '../../../shared/utils/formatters'
import {
  getInventoryCategoryLabel,
  getInventoryCategoryValue,
} from '../utils/inventoryFilters'

const INVENTORY_EMPTY_VALUE = '\u2014'

function normalizeTableCellValue(value) {
  const normalizedValue = String(value ?? '').trim()
  return normalizedValue === '-' ? '' : normalizedValue
}

function renderTableCellText(value, className = '') {
  const normalizedValue = normalizeTableCellValue(value)
  const resolvedClassName = normalizedValue
    ? `inventory-table-text ${className}`.trim()
    : `inventory-table-text inventory-table-text--placeholder ${className}`.trim()

  return (
    <span
      className={resolvedClassName}
      title={normalizedValue || undefined}
    >
      {normalizedValue || INVENTORY_EMPTY_VALUE}
    </span>
  )
}

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
    <div
      className="inventory-table-shell inventory-table-shell--scrollable"
      role="region"
      aria-label="Inventory records table"
      tabIndex={0}
    >
      <table className="inventory-table">
        <colgroup>
          <col className="inventory-table-col inventory-table-col--product" />
          <col className="inventory-table-col inventory-table-col--category" />
          <col className="inventory-table-col inventory-table-col--stock" />
          <col className="inventory-table-col inventory-table-col--unit" />
          <col className="inventory-table-col inventory-table-col--expiry" />
          <col className="inventory-table-col inventory-table-col--status" />
          <col className="inventory-table-col inventory-table-col--actions" />
        </colgroup>
        <thead>
          <tr>
            <th className="inventory-table-column inventory-table-column--product">Product</th>
            <th className="inventory-table-column inventory-table-column--category">Category</th>
            <th className="inventory-table-column inventory-table-column--stock">Stock</th>
            <th className="inventory-table-column inventory-table-column--unit">Unit / Pack Size</th>
            <th className="inventory-table-column inventory-table-column--expiry">Expiry</th>
            <th className="inventory-table-column inventory-table-column--status">Status</th>
            <th className="inventory-table-column inventory-table-column--actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const status = getInventoryStatus(item)
            const actionButtons = [
              canUpdateStock
                ? {
                    key: 'stock-in',
                    label: 'Stock In',
                    onClick: () => onStockIn?.(item),
                    variant: '',
                  }
                : null,
              canEditCatalog
                ? {
                    key: 'edit',
                    label: 'Edit',
                    onClick: () => onEdit?.(item),
                    variant: '',
                  }
                : null,
              canUpdateStock
                ? {
                    key: 'adjust-stock',
                    label: 'Adjust Stock',
                    onClick: () => onAdjustStock?.(item),
                    variant: '',
                  }
                : null,
              canEditCatalog
                ? {
                    key: 'remove',
                    label: 'Remove',
                    onClick: () => onRemove?.(item),
                    variant: 'table-action-button-danger',
                  }
                : null,
            ].filter(Boolean)

            return (
              <tr key={item.id}>
                <td className="inventory-table-column inventory-table-column--product">
                  {renderTableCellText(item.product_name, 'inventory-table-text--product')}
                </td>
                <td className="inventory-table-column inventory-table-column--category">
                  {renderTableCellText(
                    getInventoryCategoryLabel(getInventoryCategoryValue(item)),
                    'inventory-table-text--category',
                  )}
                </td>
                <td className="inventory-table-column inventory-table-column--stock">
                  {renderTableCellText(item.stock_quantity, 'inventory-table-text--numeric')}
                </td>
                <td className="inventory-table-column inventory-table-column--unit">
                  {renderTableCellText(item.unit, 'inventory-table-text--unit')}
                </td>
                <td className="inventory-table-column inventory-table-column--expiry">
                  {renderTableCellText(shortDate(item.expiry_date), 'inventory-table-text--numeric')}
                </td>
                <td className="inventory-table-column inventory-table-column--status">
                  <div className="inventory-status-cell">
                    <StatusBadge text={status.label} variant={status.tone} />
                  </div>
                </td>
                <td className="inventory-table-column inventory-table-column--actions">
                  <div className="inventory-actions">
                    {actionButtons.map((button) => (
                      <button
                        key={button.key}
                        type="button"
                        className={
                          button.variant
                            ? `table-action-button ${button.variant}`
                            : 'table-action-button'
                        }
                        onClick={button.onClick}
                      >
                        {button.label}
                      </button>
                    ))}
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
