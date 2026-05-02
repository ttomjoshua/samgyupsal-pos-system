import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../../../shared/components/common/EmptyState'
import Loader from '../../../shared/components/common/Loader'
import NoticeBanner from '../../../shared/components/common/NoticeBanner'
import {
  getBranches,
  getCachedBranches,
} from '../../branches/services/branchService'
import {
  getCachedInventoryItems,
  getInventoryItems,
} from '../../inventory/services/inventoryService'
import {
  getCachedProfilesDirectory,
  getProfilesDirectory,
} from '../../users/services/profileService'
import {
  getCachedReportSnapshot,
  getReportSnapshot,
} from '../../reports/services/reportService'
import { isSupabaseAuthEnabled } from '../../../shared/supabase/client'
import { getLocalUsers } from '../../users/services/userService'
import { peso } from '../../../shared/utils/formatters'
import {
  ROLE_EMPLOYEE,
  isAdminUser,
} from '../../../shared/utils/permissions'
import useAuth from '../../auth/hooks/useAuth'
import '../styles/dashboard.css'

function getTodayRange() {
  const today = new Date().toISOString().slice(0, 10)

  return {
    dateFrom: today,
    dateTo: today,
  }
}

function buildInitialDashboardSnapshot(user, isAdmin) {
  const inventoryScope =
    isAdmin || !user?.branchId
      ? {}
      : { branchId: user.branchId }
  const reportScope = isAdmin
    ? {}
    : {
        ...getTodayRange(),
        branchId: user?.branchId ?? null,
        cashierId: user?.id ?? null,
      }
  const cachedBranches = getCachedBranches() || []
  const cachedInventoryResponse = getCachedInventoryItems(inventoryScope)
  const cachedInventoryItems =
    cachedInventoryResponse?.items || cachedInventoryResponse || []
  const cachedAccounts = isAdmin
    ? isSupabaseAuthEnabled
      ? getCachedProfilesDirectory() || []
      : getLocalUsers()
    : []
  const cachedReport = getCachedReportSnapshot(reportScope)
  const hasCachedSnapshot =
    cachedBranches.length > 0 ||
    cachedInventoryItems.length > 0 ||
    cachedAccounts.length > 0 ||
    Boolean(cachedReport)

  return {
    isLoading: !hasCachedSnapshot,
    hasPartialError: false,
    branches: cachedBranches,
    inventoryItems: cachedInventoryItems,
    accounts: cachedAccounts,
    report: cachedReport,
  }
}

function DashboardPage() {
  const { user } = useAuth()
  const isAdmin = isAdminUser(user)
  const [snapshot, setSnapshot] = useState(() =>
    buildInitialDashboardSnapshot(user, isAdmin),
  )

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      const loadDashboardSnapshot = async () => {
        setSnapshot((previousSnapshot) => ({
          ...previousSnapshot,
          isLoading:
            previousSnapshot.branches.length === 0 &&
            previousSnapshot.inventoryItems.length === 0 &&
            previousSnapshot.accounts.length === 0 &&
            !previousSnapshot.report,
        }))

        const inventoryScope =
          isAdmin || !user?.branchId
            ? {}
            : { branchId: user.branchId }
        const reportScope = isAdmin
          ? {}
          : {
              ...getTodayRange(),
              branchId: user?.branchId ?? null,
              cashierId: user?.id ?? null,
            }

        const [
          branchesResult,
          inventoryResult,
          directoryResult,
          reportResult,
        ] = await Promise.allSettled([
          getBranches(),
          getInventoryItems(inventoryScope),
          isAdmin
            ? isSupabaseAuthEnabled
              ? getProfilesDirectory()
              : Promise.resolve(getLocalUsers())
            : Promise.resolve([]),
          getReportSnapshot(reportScope),
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
      }

      void loadDashboardSnapshot()
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
    }
  }, [isAdmin, user])

  const employeeAccounts = useMemo(
    () =>
      snapshot.accounts.filter((account) => account.roleKey === ROLE_EMPLOYEE),
    [snapshot.accounts],
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
  const predictiveStockoutRows = snapshot.report?.predictiveStockout || []
  const nearExpiryRows = snapshot.report?.nearExpiry || []
  const lowStockPreview = lowStockRows.slice(0, 5)
  const inventoryRiskCount = predictiveStockoutRows.length + nearExpiryRows.length
  const inventoryRiskPreview = [
    ...predictiveStockoutRows.slice(0, 3).map((item) => ({
      id: `stockout-${item.id}`,
      item: item.item,
      status: `Stockout ${item.status}`,
      value: item.estimatedDaysBeforeStockout,
      note: `Est. ${item.estimatedStockoutDate}`,
    })),
    ...nearExpiryRows.slice(0, 3).map((item) => ({
      id: `expiry-${item.id}`,
      item: item.item,
      status: item.status,
      value: item.daysToExpiry,
      note: item.batch,
    })),
    ...lowStockPreview.map((item) => ({
      id: `low-${item.id}`,
      item: item.item,
      status: item.status,
      value: item.stock,
      note: `Reorder at ${item.reorderLevel}`,
    })),
  ].slice(0, 5)
  const topItemsPreview = (snapshot.report?.topItems || []).slice(0, 5)
  const summary = snapshot.report?.summary || {
    total_sales: 0,
    transaction_count: 0,
    items_sold: 0,
    low_stock_count: lowStockRows.length,
    predictive_stockout_count: predictiveStockoutRows.length,
    near_expiry_count: nearExpiryRows.length,
  }
  const todayLabel = new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())
  const assignedBranchName =
    user?.branchName || snapshot.branches[0]?.name || 'Assigned branch'
  const lowStockMessage =
    inventoryRiskCount > 0
      ? `${inventoryRiskCount} predictive or expiry alert${inventoryRiskCount === 1 ? '' : 's'} need review`
      : lowStockRows.length === 0
      ? 'No urgent stock alerts'
      : `${lowStockRows.length} item${lowStockRows.length === 1 ? '' : 's'} need restock attention`
  const transactionStatusLabel =
    summary.transaction_count === 0
      ? 'No completed sales yet'
      : `${summary.transaction_count} transaction${summary.transaction_count === 1 ? '' : 's'} recorded today`

  if (snapshot.isLoading) {
    return <Loader message="Loading dashboard..." />
  }

  if (isAdmin) {
    return (
      <section className="page-shell dashboard-page">
        <div className="page-header">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h2>Operations Snapshot</h2>
            <p className="supporting-text">
              Review branch, staff, inventory, and sales at a glance.
            </p>
          </div>
        </div>

        {snapshot.hasPartialError ? (
          <NoticeBanner
            variant="warning"
            title="Partial data loaded"
            message="Some dashboard data could not be loaded. You can still navigate to other screens."
          />
        ) : inventoryRiskCount > 0 ? (
          <NoticeBanner
            variant="warning"
            title="Inventory risk attention"
            message={`${predictiveStockoutRows.length} stockout alert${predictiveStockoutRows.length === 1 ? '' : 's'} and ${nearExpiryRows.length} near-expiry alert${nearExpiryRows.length === 1 ? '' : 's'} are active.`}
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
              {snapshot.branches.length} saved branches
            </p>
          </article>

          <article className="info-card">
            <p className="card-label">Active Employees</p>
            <strong>{activeEmployees}</strong>
            <p className="supporting-text">
              {employeeAccounts.length} employee account{employeeAccounts.length === 1 ? '' : 's'}
            </p>
          </article>

          <article className="info-card">
            <p className="card-label">Catalog Items</p>
            <strong>{snapshot.inventoryItems.length}</strong>
            <p className="supporting-text">Visible inventory rows</p>
          </article>

          <article className="info-card">
            <p className="card-label">Low-Stock Items</p>
            <strong>{summary.low_stock_count}</strong>
            <p className="supporting-text">Need attention</p>
          </article>

          <article className="info-card">
            <p className="card-label">Stockout Alerts</p>
            <strong>{summary.predictive_stockout_count}</strong>
            <p className="supporting-text">Projected by sales velocity</p>
          </article>

          <article className="info-card">
            <p className="card-label">Near Expiry</p>
            <strong>{summary.near_expiry_count}</strong>
            <p className="supporting-text">Batch expiry window</p>
          </article>
        </div>

        <div className="card-grid">
          <article className="info-card">
            <p className="card-label">Total Sales</p>
            <strong>{peso(summary.total_sales)}</strong>
            <p className="supporting-text">Recorded sales value</p>
          </article>

          <article className="info-card">
            <p className="card-label">Transactions</p>
            <strong>{summary.transaction_count}</strong>
            <p className="supporting-text">Completed sales</p>
          </article>

          <article className="info-card">
            <p className="card-label">Items Sold</p>
            <strong>{summary.items_sold}</strong>
            <p className="supporting-text">Units sold</p>
          </article>
        </div>

        <div className="dashboard-secondary-grid">
          <div className="panel">
            <p className="card-label">Immediate Attention</p>
            <h3 className="dashboard-panel-title">Inventory Risk Watchlist</h3>

            {inventoryRiskPreview.length === 0 ? (
              <EmptyState
                title="No urgent stock alerts"
                description="Current inventory is above reorder levels for the items loaded into this workspace."
              />
            ) : (
              <ul className="dashboard-list">
                {inventoryRiskPreview.map((item) => (
                  <li key={item.id} className="dashboard-list-item">
                    <div className="dashboard-list-copy">
                      <strong>{item.item}</strong>
                      <span>{item.status}</span>
                    </div>
                    <div className="dashboard-list-meta">
                      <strong>{item.value}</strong>
                      <span>{item.note}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel">
            <p className="card-label">Top Sellers</p>
            <h3 className="dashboard-panel-title">Best Sellers Today</h3>

            {topItemsPreview.length === 0 ? (
              <EmptyState
                title="No sales recorded yet"
                description="Best-selling items will appear here after the first completed sale for today."
              />
            ) : (
              <ul className="dashboard-list">
                {topItemsPreview.map((item) => (
                  <li key={item.id} className="dashboard-list-item">
                    <div className="dashboard-list-copy">
                      <strong>{item.item}</strong>
                      <span>{item.sold} unit{Number(item.sold) === 1 ? '' : 's'} sold</span>
                    </div>
                    <div className="dashboard-list-meta">
                      <strong>{item.revenue}</strong>
                      <span>Revenue today</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="page-shell dashboard-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2>Today&apos;s Sales Snapshot</h2>
          <p className="supporting-text">
            Track your completed sales and assigned branch inventory for {todayLabel}.
          </p>
        </div>
      </div>

      {snapshot.hasPartialError ? (
        <NoticeBanner
          variant="warning"
          title="Partial data loaded"
          message="Some dashboard details could not be restored. Your sales workspace is still available."
        />
      ) : inventoryRiskCount > 0 ? (
        <NoticeBanner
          variant="warning"
          title="Assigned branch needs attention"
          message={`${inventoryRiskCount} predictive or near-expiry alert${inventoryRiskCount === 1 ? '' : 's'} in ${assignedBranchName} need review.`}
        />
      ) : lowStockRows.length > 0 ? (
        <NoticeBanner
          variant="warning"
          title="Assigned branch needs attention"
          message={`${lowStockRows.length} item${lowStockRows.length === 1 ? '' : 's'} in ${assignedBranchName} are already at or below reorder level.`}
        />
      ) : summary.transaction_count > 0 ? (
        <NoticeBanner
          variant="success"
          title="Sales are recorded for today"
          message={`You have completed ${summary.transaction_count} transaction${summary.transaction_count === 1 ? '' : 's'} worth ${peso(summary.total_sales)} today.`}
        />
      ) : (
        <NoticeBanner
          variant="info"
          title="Shift is ready"
          message={`No completed sales have been recorded for ${assignedBranchName} yet today.`}
        />
      )}

      <div className="dashboard-metrics-grid">
        <article className="info-card">
          <p className="card-label">Today&apos;s Sales</p>
          <strong>{peso(summary.total_sales)}</strong>
          <p className="supporting-text">Completed sales under your account.</p>
        </article>

        <article className="info-card">
          <p className="card-label">Transactions</p>
          <strong>{summary.transaction_count}</strong>
          <p className="supporting-text">Checkouts completed today.</p>
        </article>

        <article className="info-card">
          <p className="card-label">Items Sold</p>
          <strong>{summary.items_sold}</strong>
          <p className="supporting-text">Product units sold today.</p>
        </article>

        <article className="info-card">
          <p className="card-label">Assigned Branch</p>
          <strong className="dashboard-metric-branch">{assignedBranchName}</strong>
          <p className="supporting-text">
            {snapshot.inventoryItems.length} stock record{snapshot.inventoryItems.length === 1 ? '' : 's'} in scope.
          </p>
        </article>

        <article className="info-card">
          <p className="card-label">Stockout Alerts</p>
          <strong>{summary.predictive_stockout_count}</strong>
          <p className="supporting-text">Projected by recent selling pace.</p>
        </article>

        <article className="info-card">
          <p className="card-label">Near Expiry</p>
          <strong>{summary.near_expiry_count}</strong>
          <p className="supporting-text">Batches inside the warning window.</p>
        </article>
      </div>

      <div className="dashboard-secondary-grid">
        <div className="panel">
          <p className="card-label">Today&apos;s Top Items</p>
          <h3 className="dashboard-panel-title">Best Sellers on Your Shift</h3>

          {topItemsPreview.length === 0 ? (
            <EmptyState
              title="No completed sales yet"
              description="Top-selling items will appear here after your first successful checkout today."
            />
          ) : (
            <ul className="dashboard-list">
              {topItemsPreview.map((item) => (
                <li key={item.id} className="dashboard-list-item">
                  <div className="dashboard-list-copy">
                    <strong>{item.item}</strong>
                    <span>{item.sold} unit{Number(item.sold) === 1 ? '' : 's'} sold</span>
                  </div>
                  <div className="dashboard-list-meta">
                    <strong>{item.revenue}</strong>
                    <span>Revenue today</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <p className="card-label">Shift Overview</p>
          <h3 className="dashboard-panel-title">Assigned Scope</h3>

          <ul className="dashboard-list">
            <li className="dashboard-list-item">
              <div className="dashboard-list-copy">
                <strong>{assignedBranchName}</strong>
                <span>Assigned branch</span>
              </div>
              <div className="dashboard-list-meta">
                <strong>{todayLabel}</strong>
                <span>Working date</span>
              </div>
            </li>

            <li className="dashboard-list-item">
              <div className="dashboard-list-copy">
                <strong>{snapshot.inventoryItems.length}</strong>
                <span>Visible inventory rows</span>
              </div>
              <div className="dashboard-list-meta">
                <strong>{summary.items_sold}</strong>
                <span>Units sold today</span>
              </div>
            </li>

            <li className="dashboard-list-item">
              <div className="dashboard-list-copy">
                <strong>{lowStockMessage}</strong>
                <span>Restock status</span>
              </div>
              <div className="dashboard-list-meta">
                <strong>{transactionStatusLabel}</strong>
                <span>Sales status</span>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div className="panel">
        <p className="card-label">Restock Watchlist</p>
        <h3 className="dashboard-panel-title">Assigned Branch Alerts</h3>

        {inventoryRiskPreview.length === 0 ? (
          <EmptyState
            title="No urgent stock alerts"
            description="Your assigned branch inventory is currently above reorder levels."
          />
        ) : (
          <ul className="dashboard-list">
            {inventoryRiskPreview.map((item) => (
              <li key={item.id} className="dashboard-list-item">
                <div className="dashboard-list-copy">
                  <strong>{item.item}</strong>
                  <span>{item.status}</span>
                </div>
                <div className="dashboard-list-meta">
                  <strong>{item.value}</strong>
                  <span>{item.note}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default DashboardPage
