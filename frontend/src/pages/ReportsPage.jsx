import { useEffect, useState } from 'react'
import EmptyState from '../components/common/EmptyState'
import Loader from '../components/common/Loader'
import NoticeBanner from '../components/common/NoticeBanner'
import StatusBadge from '../components/common/StatusBadge'
import SummaryCards from '../components/reports/SummaryCards'
import TopItemsTable from '../components/reports/TopItemsTable'
import {
  getReportSnapshot,
} from '../services/reportService'
import {
  getFirstValidationError,
  validateReportDateRange,
} from '../utils/validation'
import { shortDate } from '../utils/formatters'
import '../styles/reports.css'

function ReportsPage() {
  const [reportData, setReportData] = useState({
    summary: {},
    topItems: [],
    lowStock: [],
    cashierPerformance: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('2026-04-01')
  const [dateTo, setDateTo] = useState('2026-04-14')
  const [filterError, setFilterError] = useState('')
  const [filterMessage, setFilterMessage] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const loadReports = async () => {
      try {
        const snapshot = await getReportSnapshot()
        setReportData(snapshot)
        setLoadError('')
      } catch (error) {
        console.error('Failed to load report snapshot:', error)
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
    }

    loadReports()
  }, [])

  const handleApplyFilter = () => {
    const validation = validateReportDateRange({ dateFrom, dateTo })

    if (!validation.isValid) {
      setFilterMessage('')
      setFilterError(getFirstValidationError(validation.errors))
      return
    }

    setFilterError('')
    setFilterMessage(
      `Date range ${shortDate(dateFrom)} to ${shortDate(dateTo)} is valid. Filtered report queries can plug into the backend when the API is ready.`,
    )
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
      <div className="reports-header">
        <div>
          <p className="eyebrow">Simple But Useful Reports</p>
          <h1>Reports</h1>
          <p className="supporting-text">
            Focus on summary totals, low-stock monitoring, and readable tables before adding charts.
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
          >
            Apply Filter
          </button>
        </div>
      </div>

      {loadError ? (
        <NoticeBanner
          variant="error"
          title="Report snapshot unavailable"
          message={loadError}
        />
      ) : null}

      {filterError ? (
        <NoticeBanner
          variant="error"
          title="Invalid report date range"
          message={filterError}
        />
      ) : null}

      {!filterError && filterMessage ? (
        <NoticeBanner
          variant="success"
          title="Report filter ready"
          message={filterMessage}
        />
      ) : null}

      {isLoading ? (
        <Loader message="Loading report snapshot..." />
      ) : loadError ? (
        <EmptyState
          title="Reports are currently unavailable"
          description="The reports screen stayed open safely, but the report snapshot could not be loaded."
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
