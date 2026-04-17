import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../../../shared/components/common/EmptyState'
import Loader from '../../../shared/components/common/Loader'
import NoticeBanner from '../../../shared/components/common/NoticeBanner'
import { getBranches } from '../../branches/services/branchService'
import { getInventoryItems } from '../../inventory/services/inventoryService'
import { getProfilesDirectory } from '../../users/services/profileService'
import { getReportSnapshot } from '../../reports/services/reportService'
import { isSupabaseAuthEnabled } from '../../../shared/api/supabaseClient'
import { getMockUsers } from '../../users/services/userService'
import { peso } from '../../../shared/utils/formatters'
import {
  ROLE_EMPLOYEE,
  getVisibleNavItems,
} from '../../../shared/utils/permissions'
import useAuth from '../../auth/hooks/useAuth'
import '../styles/dashboard.css'

const MODULE_DESCRIPTIONS = {
  dashboard: 'Review the latest branch, staff, and stock summary.',
  pos: 'Process sales and complete cashier checkout.',
  inventory: 'Manage stock levels, expiry dates, and inventory actions.',
  reports: 'Track totals, transactions, and low-stock watchlists.',
  products: 'Maintain categories and review the active product catalog.',
  users: 'Manage branches, employee accounts, and access status.',
}

function DashboardPage() {
  const { user } = useAuth()
  const visibleSections = getVisibleNavItems(user)
  const [snapshot, setSnapshot] = useState({
    isLoading: true,
    hasPartialError: false,
    branches: [],
    inventoryItems: [],
    accounts: [],
    report: null,
  })

  const loadDashboardSnapshot = useCallback(async () => {
    setSnapshot((previousSnapshot) => ({
      ...previousSnapshot,
      isLoading: true,
    }))

    const [
      branchesResult,
      inventoryResult,
      directoryResult,
      reportResult,
    ] = await Promise.allSettled([
      getBranches(),
      getInventoryItems(),
      isSupabaseAuthEnabled ? getProfilesDirectory() : Promise.resolve(getMockUsers()),
      getReportSnapshot(),
    ])

    setSnapshot({
      isLoading: false,
      hasPartialError: [
        branchesResult,
        inventoryResult,
        directoryResult,
        reportResult,
      ].some((result) => result.status === 'rejected'),
      branches:
        branchesResult.status === 'fulfilled' ? branchesResult.value : [],
      inventoryItems:
        inventoryResult.status === 'fulfilled'
          ? inventoryResult.value.items || inventoryResult.value
          : [],
      accounts:
        directoryResult.status === 'fulfilled' ? directoryResult.value : [],
      report: reportResult.status === 'fulfilled' ? reportResult.value : null,
    })
  }, [])

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadDashboardSnapshot()
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
    }
  }, [loadDashboardSnapshot])

  const employeeAccounts = useMemo(
    () =>
      snapshot.accounts.filter((account) => account.roleKey === ROLE_EMPLOYEE),
    [snapshot.accounts],
  )

  const quickAccessSections = useMemo(
    () => visibleSections.filter((section) => section.key !== 'dashboard'),
    [visibleSections],
  )

  const activeBranches = useMemo(
    () =>
      snapshot.branches.filter((branch) => branch.status !== 'inactive').length,
    [snapshot.branches],
  )

  const activeEmployees = useMemo(
    () =>
      employeeAccounts.filter((account) => account.status === 'active').length,
    [employeeAccounts],
  )

  const lowStockRows = snapshot.report?.lowStock || []
  const lowStockPreview = lowStockRows.slice(0, 5)
  const summary = snapshot.report?.summary || {
    total_sales: 0,
    transaction_count: 0,
    items_sold: 0,
    low_stock_count: lowStockRows.length,
  }

  if (snapshot.isLoading) {
    return <Loader message="Loading dashboard..." />
  }

  return (
    <section className="page-shell dashboard-page">
      <div className="page-header">
        <p className="eyebrow">Dashboard</p>
        <h2>Operations Snapshot</h2>
        <p className="supporting-text">
          Review today&apos;s branch, staff, inventory, and sales picture at a glance.
        </p>
      </div>

      {snapshot.hasPartialError ? (
        <NoticeBanner
          variant="warning"
          title="Partial data loaded"
          message="Some dashboard data could not be loaded. You can still navigate to other screens."
        />
      ) : lowStockRows.length > 0 ? (
        <NoticeBanner
          variant="warning"
          title="Restock attention needed"
          message={`${lowStockRows.length} item${lowStockRows.length === 1 ? '' : 's'} are already at or below reorder level.`}
        />
      ) : (
        <NoticeBanner
          variant="success"
          title="Operations look stable"
          message={`${activeBranches} active branch${activeBranches === 1 ? '' : 'es'} and ${activeEmployees} active employee account${activeEmployees === 1 ? '' : 's'} are ready for use.`}
        />
      )}

      <div className="dashboard-metrics-grid">
        <article className="info-card">
          <p className="card-label">Active Branches</p>
          <strong>{activeBranches}</strong>
          <p className="supporting-text">
            {snapshot.branches.length} branch records in the directory
          </p>
        </article>

        <article className="info-card">
          <p className="card-label">Active Employees</p>
          <strong>{activeEmployees}</strong>
          <p className="supporting-text">
            {employeeAccounts.length} employee account{employeeAccounts.length === 1 ? '' : 's'} available
          </p>
        </article>

        <article className="info-card">
          <p className="card-label">Catalog Items</p>
          <strong>{snapshot.inventoryItems.length}</strong>
          <p className="supporting-text">Inventory rows currently visible</p>
        </article>

        <article className="info-card">
          <p className="card-label">Low-Stock Items</p>
          <strong>{summary.low_stock_count}</strong>
          <p className="supporting-text">Products at or below reorder level</p>
        </article>
      </div>

      <div className="card-grid">
        <article className="info-card">
          <p className="card-label">Total Sales</p>
          <strong>{peso(summary.total_sales)}</strong>
          <p className="supporting-text">Recorded sales value in the current dataset</p>
        </article>

        <article className="info-card">
          <p className="card-label">Transactions</p>
          <strong>{summary.transaction_count}</strong>
          <p className="supporting-text">Completed checkout records</p>
        </article>

        <article className="info-card">
          <p className="card-label">Items Sold</p>
          <strong>{summary.items_sold}</strong>
          <p className="supporting-text">Units included in recorded sales</p>
        </article>
      </div>

      <div className="dashboard-secondary-grid">
        <div className="panel">
          <p className="card-label">Immediate Attention</p>
          <h3 className="dashboard-panel-title">Restock Watchlist</h3>

          {lowStockPreview.length === 0 ? (
            <EmptyState
              title="No urgent stock alerts"
              description="Current inventory is above reorder levels for the items loaded into this workspace."
            />
          ) : (
            <ul className="dashboard-list">
              {lowStockPreview.map((item) => (
                <li key={item.id} className="dashboard-list-item">
                  <div className="dashboard-list-copy">
                    <strong>{item.item}</strong>
                    <span>{item.status}</span>
                  </div>
                  <div className="dashboard-list-meta">
                    <strong>{item.stock}</strong>
                    <span>Reorder at {item.reorderLevel}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <p className="card-label">Quick Access</p>
          <h3 className="dashboard-panel-title">Open a Working Screen</h3>

          {quickAccessSections.length === 0 ? (
            <EmptyState
              title="No extra modules available"
              description="Additional screens will appear here when this account has access to them."
            />
          ) : (
            <div className="dashboard-actions">
              {quickAccessSections.map((section) => (
                <Link key={section.key} to={section.to} className="dashboard-action-link">
                  <div className="dashboard-action-copy">
                    <strong>{section.label}</strong>
                    <span>
                      {MODULE_DESCRIPTIONS[section.key] || 'Open this workspace section.'}
                    </span>
                  </div>
                  <span className="dashboard-action-arrow" aria-hidden="true">
                    {'->'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default DashboardPage
