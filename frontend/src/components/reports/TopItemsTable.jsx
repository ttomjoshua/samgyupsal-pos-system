import EmptyState from '../common/EmptyState'

function TopItemsTable({ columns, rows, eyebrow, title }) {
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
              {rows.map((row) => (
                <tr key={row.id}>
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
    </section>
  )
}

export default TopItemsTable
