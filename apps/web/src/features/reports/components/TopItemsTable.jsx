import { useMemo, useState } from 'react'
import EmptyState from '../../../shared/components/common/EmptyState'
import PaginationControls from '../../../shared/components/common/PaginationControls'

function TopItemsTable({
  columns,
  rows,
  eyebrow,
  title,
  pageSize = null,
  summaryLabel = 'rows',
}) {
  const [paginationState, setPaginationState] = useState({
    page: 1,
    seed: null,
  })
  const isPaginated = Number(pageSize) > 0
  const paginationSeed = useMemo(
    () => `${pageSize}:${rows.length}:${rows.map((row) => row.id ?? '').join('|')}`,
    [pageSize, rows],
  )
  const totalPages = isPaginated
    ? Math.max(1, Math.ceil(rows.length / Number(pageSize)))
    : 1
  const currentPage =
    paginationState.seed === paginationSeed ? paginationState.page : 1
  const visiblePage = Math.min(Math.max(currentPage, 1), totalPages)

  const visibleRows = useMemo(() => {
    if (!isPaginated) {
      return rows
    }

    const startIndex = (visiblePage - 1) * Number(pageSize)
    return rows.slice(startIndex, startIndex + Number(pageSize))
  }, [isPaginated, pageSize, rows, visiblePage])

  return (
    <section className="reports-panel">
      <div className="reports-panel-header">
        <div>
          <p className="card-label">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="reports-empty-shell">
          <EmptyState
            title="No report rows available"
            description="This section will populate when transactions and stock history are ready."
          />
        </div>
      ) : (
        <div className="reports-table-shell">
          <table className="reports-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr key={row.id ?? `${title}-${index}`}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && isPaginated ? (
        <div className="reports-panel-footer">
          <PaginationControls
            currentPage={visiblePage}
            totalPages={totalPages}
            totalItems={rows.length}
            pageSize={Number(pageSize)}
            onPageChange={(page) => {
              setPaginationState({
                page,
                seed: paginationSeed,
              })
            }}
            summaryLabel={summaryLabel}
          />
        </div>
      ) : null}
    </section>
  )
}

export default TopItemsTable
