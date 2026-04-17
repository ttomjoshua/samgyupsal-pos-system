import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import EmptyState from '../../../shared/components/common/EmptyState'
import Loader from '../../../shared/components/common/Loader'
import NoticeBanner from '../../../shared/components/common/NoticeBanner'
import StatusBadge from '../../../shared/components/common/StatusBadge'
import SummaryCards from '../components/SummaryCards'
import TopItemsTable from '../components/TopItemsTable'
import {
  getDefaultReportDateRange,
  getReportSnapshot,
} from '../services/reportService'
import {
  getFirstValidationError,
  validateReportDateRange,
} from '../../../shared/utils/validation'
import { shortDate } from '../../../shared/utils/formatters'
import '../styles/reports.css'

const INITIAL_REPORT_RANGE = getDefaultReportDateRange()

function ReportsPage() {
  const [reportData, setReportData] = useState({
    summary: {},
    topItems: [],
    lowStock: [],
    cashierPerformance: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(INITIAL_REPORT_RANGE.dateFrom)
  const [dateTo, setDateTo] = useState(INITIAL_REPORT_RANGE.dateTo)
  const [filterError, setFilterError] = useState('')
  const [filterMessage, setFilterMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const initialRangeRef = useRef(INITIAL_REPORT_RANGE)

  const reviewWindowLabel = useMemo(() => {
    const startDate = new Date(`${dateFrom}T00:00:00`)
    const endDate = new Date(`${dateTo}T00:00:00`)

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      return 'Custom'
    }

    const daySpan = Math.max(
      1,
      Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1,
    )

    return `${daySpan} day${daySpan === 1 ? '' : 's'}`
  }, [dateFrom, dateTo])

  const loadReportsForRange = useCallback(async (range, announceRange = true) => {
    try {
      if (announceRange) {
        setFilterMessage('')
      }
      setIsLoading(true)
      const snapshot = await getReportSnapshot(range)
      setReportData(snapshot)
      setLoadError('')

      if (announceRange) {
        setFilterMessage(
          `Showing results from ${shortDate(range.dateFrom)} to ${shortDate(range.dateTo)}.`,
        )
      }
    } catch (error) {
      console.error('Failed to load report snapshot:', error)
      setFilterMessage('')
      setReportData({
        summary: {},
        topItems: [],
        lowStock: [],
        cashierPerformance: [],
      })
      setLoadError(
        error.response?.data?.message ||
          'Reports could not be loaded right now.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadReportsForRange(initialRangeRef.current, false)
  }, [loadReportsForRange])

  const handleApplyFilter = () => {
    const validation = validateReportDateRange({ dateFrom, dateTo })

    if (!validation.isValid) {
      setFilterMessage('')
      setFilterError(getFirstValidationError(validation.errors))
      return
    }

    setFilterError('')
    void loadReportsForRange({ dateFrom, dateTo })
  }

  const topItemsColumns = [
    { key: 'item', label: 'Item' },
    { key: 'sold', label: 'Units Sold' },
    { key: 'revenue', label: 'Revenue' },
  ]
  const lowStockColumns = [
    { key: 'item', label: 'Item' },
    { key: 'stock', label: 'Stock' },
    { key: 'reorderLevel', label: 'Reorder Level' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge text={row.status} variant="warning" />,
    },
  ]
  const cashierColumns = [
    { key: 'cashier', label: 'Cashier' },
    { key: 'sales', label: 'Sales Total' },
    { key: 'transactions', label: 'Transactions' },
  ]

  return (
    <section className="reports-page">
      <div className="reports-topbar">
        <div className="reports-title-block">
          <p className="eyebrow">Business Reporting</p>
          <h1>Reports</h1>
          <p className="supporting-text">
            Review sales performance, cashier activity, and stock risk in one reporting workspace.
          </p>
        </div>

        <div className="reports-meta-grid">
          <article className="reports-meta-card">
            <span className="meta-label">From</span>
            <strong className="meta-primary">{shortDate(dateFrom)}</strong>
            <span className="meta-secondary">
              Start of selected reporting period.
            </span>
          </article>

          <article className="reports-meta-card">
            <span className="meta-label">To</span>
            <strong className="meta-primary">{shortDate(dateTo)}</strong>
            <span className="meta-secondary">
              End of selected reporting period.
            </span>
          </article>

          <article className="reports-meta-card">
            <span className="meta-label">Review Window</span>
            <strong className="meta-primary">{reviewWindowLabel}</strong>
            <span className="meta-secondary">
              Duration covered by this report.
            </span>
          </article>
        </div>
      </div>

      <div className="panel reports-filter-panel">
        <div className="reports-filter-copy">
          <p className="card-label">Reporting Period</p>
          <h2>Set Review Range</h2>
          <p className="supporting-text">
            Adjust the date range to update all report figures.
          </p>
        </div>

        <div className="reports-date-filter">
          <label className="reports-date-field">
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setFilterError('')
                setFilterMessage('')
                setDateFrom(event.target.value)
              }}
              aria-invalid={Boolean(filterError)}
            />
          </label>
          <label className="reports-date-field">
            <span>To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setFilterError('')
                setFilterMessage('')
                setDateTo(event.target.value)
              }}
              aria-invalid={Boolean(filterError)}
            />
          </label>
          <button
            type="button"
            className="reports-filter-button"
            onClick={handleApplyFilter}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Apply Range'}
          </button>
        </div>
      </div>

      {loadError ? (
        <NoticeBanner
          variant="error"
          title="Report unavailable"
          message={loadError}
        />
      ) : null}

      {filterError ? (
        <NoticeBanner
          variant="error"
          title="Invalid date range"
          message={filterError}
        />
      ) : null}

      {!filterError && filterMessage ? (
        <NoticeBanner
          variant="success"
          title="Filter applied"
          message={filterMessage}
        />
      ) : null}

      {isLoading ? (
        <Loader message="Loading report snapshot..." />
      ) : loadError ? (
        <EmptyState
          title="Reports are currently unavailable"
          description="The report snapshot could not be loaded. Check the data source and try again."
        />
      ) : (
        <>
          <SummaryCards summary={reportData.summary} />

          <div className="reports-table-grid">
            <TopItemsTable
              columns={topItemsColumns}
              rows={reportData.topItems}
              eyebrow="Top-Selling Items"
              title="Best performers"
            />

            <TopItemsTable
              columns={lowStockColumns}
              rows={reportData.lowStock}
              eyebrow="Low-Stock Items"
              title="Restock watchlist"
              pageSize={6}
              summaryLabel="watchlist items"
            />
          </div>

          <TopItemsTable
            columns={cashierColumns}
            rows={reportData.cashierPerformance}
            eyebrow="Sales by Cashier"
            title="Daily cashier performance"
          />
        </>
      )}
    </section>
  )
}

export default ReportsPage
