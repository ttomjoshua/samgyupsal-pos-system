function OperationsPreview() {
  return (
    <div className="operations-preview">
      <div className="operations-preview-sidebar">
        <div className="operations-preview-sidebar-mark">SP</div>

        <div className="operations-preview-sidebar-nav">
          <span className="active">Dashboard</span>
          <span>Sales</span>
          <span>Inventory</span>
          <span>Reports</span>
          <span>Users</span>
        </div>
      </div>

      <div className="operations-preview-workspace">
        <div className="operations-preview-topbar">
          <div className="operations-preview-topbar-copy">
            <strong>Operations Snapshot</strong>
            <span>Dollar Branch · Today</span>
          </div>

          <div className="operations-preview-topbar-badges">
            <span>3 branches active</span>
            <span className="accent">11 low stock</span>
          </div>
        </div>

        <div className="operations-preview-metrics">
          <article className="operations-preview-metric">
            <span>Sales Today</span>
            <strong>P42,860</strong>
          </article>

          <article className="operations-preview-metric">
            <span>Transactions</span>
            <strong>96</strong>
          </article>

          <article className="operations-preview-metric">
            <span>Items Expiring</span>
            <strong>4</strong>
          </article>
        </div>

        <div className="operations-preview-grid">
          <section className="operations-preview-panel operations-preview-panel--wide">
            <div className="operations-preview-panel-header">
              <strong>Recent Sales</strong>
              <span>POS</span>
            </div>

            <div className="operations-preview-list">
              <div>
                <span>Table 12 checkout</span>
                <strong>P2,480</strong>
              </div>
              <div>
                <span>Senior discount applied</span>
                <strong>P1,248</strong>
              </div>
              <div>
                <span>Cash received logged</span>
                <strong>P5,000</strong>
              </div>
            </div>
          </section>

          <section className="operations-preview-panel">
            <div className="operations-preview-panel-header">
              <strong>Restock Watchlist</strong>
              <span>Inventory</span>
            </div>

            <div className="operations-preview-alerts">
              <div>
                <span>Samgyup meat</span>
                <strong>Low stock</strong>
              </div>
              <div>
                <span>Korean noodles</span>
                <strong>12 packs</strong>
              </div>
              <div>
                <span>Seaweed</span>
                <strong>3 days left</strong>
              </div>
            </div>
          </section>

          <section className="operations-preview-panel">
            <div className="operations-preview-panel-header">
              <strong>Branch Overview</strong>
              <span>Monitoring</span>
            </div>

            <div className="operations-preview-branches">
              <article>
                <strong>Sta. Lucia</strong>
                <span>Normal flow</span>
              </article>
              <article>
                <strong>Dollar</strong>
                <span>Inventory alerts</span>
              </article>
              <article>
                <strong>Cainta</strong>
                <span>Strong sales</span>
              </article>
            </div>
          </section>

          <section className="operations-preview-panel">
            <div className="operations-preview-panel-header">
              <strong>Access Scope</strong>
              <span>Users</span>
            </div>

            <div className="operations-preview-scope">
              <div>
                <span>Administrators</span>
                <strong>Products, reports, users</strong>
              </div>
              <div>
                <span>Employees</span>
                <strong>Sales and branch stock</strong>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default OperationsPreview
