import EmptyState from '../components/common/EmptyState'
import NoticeBanner from '../components/common/NoticeBanner'
import useAuth from '../hooks/useAuth'
import { getVisibleNavItems, getRoleLabel } from '../utils/permissions'

function DashboardPage() {
  const { user } = useAuth()
  const visibleSections = getVisibleNavItems(user)

  return (
    <section className="page-shell">
      <div className="page-header">
        <p className="eyebrow">Dashboard</p>
        <h2>Workspace Overview</h2>
        <p className="supporting-text">
          Keep the main screens stable and readable while deeper analytics are still being built.
        </p>
      </div>

      <NoticeBanner
        variant="success"
        title="Admin access is active."
        message={`${user?.name || 'Administrator'} can currently open ${visibleSections.length} protected sections from this frontend shell.`}
      />

      <div className="card-grid">
        <article className="info-card">
          <p className="card-label">Current Role</p>
          <strong>{getRoleLabel(user?.roleKey || user?.role)}</strong>
          <p className="supporting-text">Privileges are loaded from the current auth session.</p>
        </article>

        <article className="info-card">
          <p className="card-label">Branch Scope</p>
          <strong>{user?.branchName || 'All Branches'}</strong>
          <p className="supporting-text">Branch-aware behavior is ready for the POS and users flow.</p>
        </article>

        <article className="info-card">
          <p className="card-label">Visible Modules</p>
          <strong>{visibleSections.length}</strong>
          <p className="supporting-text">Routes and sidebar visibility are already role-aware.</p>
        </article>
      </div>

      <div className="panel">
        <EmptyState
          title="Dashboard widgets are still being prepared"
          description="This screen is intentionally resilient instead of blank. Summary cards, alerts, and live snapshots can plug in here later without changing the rest of the app shell."
        />
      </div>
    </section>
  )
}

export default DashboardPage
