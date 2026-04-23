import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import EmptyState from '../../../shared/components/common/EmptyState'
import Loader from '../../../shared/components/common/Loader'
import NoticeBanner from '../../../shared/components/common/NoticeBanner'
import PaginationControls from '../../../shared/components/common/PaginationControls'
import StatusBadge from '../../../shared/components/common/StatusBadge'
import SelectMenu from '../../../shared/components/ui/SelectMenu'
import useSessionStorageState from '../../../shared/hooks/useSessionStorageState'
import { peso, shortDateTime } from '../../../shared/utils/formatters'
import { isAdminUser } from '../../../shared/utils/permissions'
import SalesHistoryDetailsModal from './SalesHistoryDetailsModal'
import {
  DEFAULT_SALES_HISTORY_PAGE_SIZE,
  SALES_HISTORY_ALL_FILTER,
  getCachedSalesHistoryPage,
  getSaleItemCount,
  getSalePaymentMethodLabel,
  getSaleReference,
  getSalesHistoryPage,
  salesHistoryPaymentMethodOptions,
} from '../services/salesService'

const EMPTY_HISTORY_PAGE = {
  records: [],
  totalCount: 0,
  totalPages: 1,
  currentPage: 1,
  pageSize: DEFAULT_SALES_HISTORY_PAGE_SIZE,
}
const SALES_HISTORY_PAGE_STATE_KEY = 'page-state:sales-history'

function buildInitialHistoryViewState(user, isAdmin) {
  return {
    transactionQuery: '',
    cashierQuery: '',
    dateFrom: '',
    dateTo: '',
    paymentMethod: SALES_HISTORY_ALL_FILTER,
    branchId: isAdmin ? SALES_HISTORY_ALL_FILTER : user?.branchId || SALES_HISTORY_ALL_FILTER,
    currentPage: 1,
  }
}

function SalesHistoryPanel({
  branchOptions = [],
  refreshKey = 0,
  user,
}) {
  const isAdmin = isAdminUser(user)
  const [historyViewState, setHistoryViewState] = useSessionStorageState(
    SALES_HISTORY_PAGE_STATE_KEY,
    () => buildInitialHistoryViewState(user, isAdmin),
  )
  const transactionQuery = historyViewState?.transactionQuery || ''
  const cashierQuery = historyViewState?.cashierQuery || ''
  const dateFrom = historyViewState?.dateFrom || ''
  const dateTo = historyViewState?.dateTo || ''
  const paymentMethod = historyViewState?.paymentMethod || SALES_HISTORY_ALL_FILTER
  const branchId =
    historyViewState?.branchId ??
    (isAdmin ? SALES_HISTORY_ALL_FILTER : user?.branchId || SALES_HISTORY_ALL_FILTER)
  const currentPage = Math.max(1, Number(historyViewState?.currentPage || 1))
  const updateHistoryViewState = (patch) => {
    setHistoryViewState((currentState) => ({
      ...(currentState || {}),
      ...(typeof patch === 'function' ? patch(currentState || {}) : patch),
    }))
  }
  const initialCachedHistoryPage = getCachedSalesHistoryPage({
    user,
    page: currentPage,
    pageSize: DEFAULT_SALES_HISTORY_PAGE_SIZE,
    transactionQuery,
    cashierQuery: isAdmin ? cashierQuery : '',
    dateFrom,
    dateTo,
    paymentMethod,
    branchId: isAdmin ? branchId : user?.branchId ?? '',
  })
  const [historyPage, setHistoryPage] = useState(
    () => initialCachedHistoryPage || EMPTY_HISTORY_PAGE,
  )
  const [isLoading, setIsLoading] = useState(() => !initialCachedHistoryPage)
  const [loadError, setLoadError] = useState('')
  const [selectedSale, setSelectedSale] = useState(null)
  const deferredTransactionQuery = useDeferredValue(transactionQuery)
  const deferredCashierQuery = useDeferredValue(cashierQuery)

  const branchFilterOptions = useMemo(
    () => [
      { value: SALES_HISTORY_ALL_FILTER, label: 'All Branches' },
      ...branchOptions.map((branch) => ({
        value: branch.id,
        label: branch.name,
      })),
    ],
    [branchOptions],
  )

  useEffect(() => {
    updateHistoryViewState((currentState) => ({
      ...(currentState || {}),
      branchId:
        isAdmin ? currentState?.branchId || SALES_HISTORY_ALL_FILTER : user?.branchId || SALES_HISTORY_ALL_FILTER,
    }))
  }, [isAdmin, user?.branchId])

  useEffect(() => {
    updateHistoryViewState((currentState) => (
      Number(currentState?.currentPage || 1) === 1
        ? currentState
        : {
            ...currentState,
            currentPage: 1,
          }
    ))
  }, [
    branchId,
    dateFrom,
    dateTo,
    deferredCashierQuery,
    deferredTransactionQuery,
    paymentMethod,
    refreshKey,
  ])

  useEffect(() => {
    let isMounted = true

    const loadHistory = async () => {
      try {
        if (!getCachedSalesHistoryPage({
          user,
          page: currentPage,
          pageSize: DEFAULT_SALES_HISTORY_PAGE_SIZE,
          transactionQuery: deferredTransactionQuery,
          cashierQuery: isAdmin ? deferredCashierQuery : '',
          dateFrom,
          dateTo,
          paymentMethod,
          branchId: isAdmin ? branchId : user?.branchId ?? '',
        })) {
          setIsLoading(true)
        }
        const nextHistoryPage = await getSalesHistoryPage({
          user,
          page: currentPage,
          pageSize: DEFAULT_SALES_HISTORY_PAGE_SIZE,
          transactionQuery: deferredTransactionQuery,
          cashierQuery: isAdmin ? deferredCashierQuery : '',
          dateFrom,
          dateTo,
          paymentMethod,
          branchId: isAdmin ? branchId : user?.branchId ?? '',
        })

        if (!isMounted) {
          return
        }

        setHistoryPage(nextHistoryPage)
        setLoadError('')

        if (nextHistoryPage.currentPage !== currentPage) {
          updateHistoryViewState({
            currentPage: nextHistoryPage.currentPage,
          })
        }

      } catch (error) {
        console.error('Failed to load sales history:', error)

        if (!isMounted) {
          return
        }

        setHistoryPage(EMPTY_HISTORY_PAGE)
        setLoadError(
          error.response?.data?.message || 'Unable to load sales history right now.',
        )
        setSelectedSale(null)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadHistory()

    return () => {
      isMounted = false
    }
  }, [
    branchId,
    currentPage,
    dateFrom,
    dateTo,
    deferredCashierQuery,
    deferredTransactionQuery,
    isAdmin,
    paymentMethod,
    refreshKey,
    user,
  ])

  useEffect(() => {
    if (!selectedSale) {
      return
    }

    const refreshedSale = historyPage.records.find(
      (record) => String(record.id) === String(selectedSale.id),
    )

    if (!refreshedSale) {
      setSelectedSale(null)
      return
    }

    if (refreshedSale !== selectedSale) {
      setSelectedSale(refreshedSale)
    }
  }, [historyPage.records, selectedSale])

  const hasActiveFilters = Boolean(
    transactionQuery ||
      cashierQuery ||
      dateFrom ||
      dateTo ||
      paymentMethod !== SALES_HISTORY_ALL_FILTER ||
      (isAdmin && branchId !== SALES_HISTORY_ALL_FILTER),
  )

  const recordsLabel =
    historyPage.totalCount === 1 ? 'transaction' : 'transactions'

  const scopeNote = isAdmin
    ? 'Review completed sales across visible branches and staff.'
    : 'Review your completed sales within your assigned account scope.'

  return (
    <>
      <section className="pos-panel sales-history-panel">
        <div className="panel-header sales-history-panel-header">
          <div>
            <p className="card-label">Sales History</p>
            <h2>Completed Transactions</h2>
            <p className="supporting-text">{scopeNote}</p>
          </div>

          <span className="panel-count">
            {historyPage.totalCount} {recordsLabel}
          </span>
        </div>

        <div className="sales-history-toolbar">
          <div className="sales-history-filter-grid">
            <label className="sales-history-field sales-history-field--wide">
              <span>Transaction</span>
              <input
                type="text"
                value={transactionQuery}
                onChange={(event) =>
                  updateHistoryViewState({
                    transactionQuery: event.target.value,
                  })
                }
                placeholder="Search transaction number"
              />
            </label>

            {isAdmin ? (
              <label className="sales-history-field sales-history-field--wide">
                <span>Cashier</span>
                <input
                  type="text"
                  value={cashierQuery}
                  onChange={(event) =>
                    updateHistoryViewState({
                      cashierQuery: event.target.value,
                    })
                  }
                  placeholder="Filter by cashier name"
                />
              </label>
            ) : null}

            <label className="sales-history-field">
              <span>Date From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) =>
                  updateHistoryViewState({
                    dateFrom: event.target.value,
                  })
                }
              />
            </label>

            <label className="sales-history-field">
              <span>Date To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) =>
                  updateHistoryViewState({
                    dateTo: event.target.value,
                  })
                }
              />
            </label>

            <label className="sales-history-field">
              <span>Payment</span>
              <SelectMenu
                className="sales-history-select"
                value={paymentMethod}
                onChange={(event) =>
                  updateHistoryViewState({
                    paymentMethod: event.target.value,
                  })
                }
                options={salesHistoryPaymentMethodOptions}
              />
            </label>

            {isAdmin ? (
              <label className="sales-history-field">
                <span>Branch</span>
                <SelectMenu
                  className="sales-history-select"
                  value={branchId}
                  onChange={(event) =>
                    updateHistoryViewState({
                      branchId: event.target.value,
                    })
                  }
                  options={branchFilterOptions}
                />
              </label>
            ) : null}
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              className="ghost-action sales-history-reset"
              onClick={() => {
                updateHistoryViewState({
                  transactionQuery: '',
                  cashierQuery: '',
                  dateFrom: '',
                  dateTo: '',
                  paymentMethod: SALES_HISTORY_ALL_FILTER,
                  branchId:
                    isAdmin
                      ? SALES_HISTORY_ALL_FILTER
                      : user?.branchId || SALES_HISTORY_ALL_FILTER,
                  currentPage: 1,
                })
              }}
            >
              Clear Filters
            </button>
          ) : null}
        </div>

        {loadError ? (
          <NoticeBanner
            variant="error"
            title="Sales history unavailable"
            message={loadError}
          />
        ) : null}

        {isLoading ? (
          <Loader message="Loading completed transactions..." />
        ) : historyPage.records.length === 0 ? (
          <div className="sales-history-empty">
            <EmptyState
              title="No completed transactions found"
              description={
                hasActiveFilters
                  ? 'Try adjusting the transaction, date, branch, or payment filters.'
                  : 'Completed sales will appear here once checkout records are saved.'
              }
            />
          </div>
        ) : (
          <>
            <div className="sales-history-table-shell" tabIndex={0}>
              <table className="sales-history-table">
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Date &amp; Time</th>
                    <th>Cashier</th>
                    <th>Branch</th>
                    <th>Items</th>
                    <th>Subtotal</th>
                    <th>Discount</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyPage.records.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <div className="sales-history-cell-primary">
                          <strong>{getSaleReference(sale)}</strong>
                          <span>{sale.items.length} line item{sale.items.length === 1 ? '' : 's'}</span>
                        </div>
                      </td>
                      <td>{shortDateTime(sale.submitted_at || sale.created_at)}</td>
                      <td>{sale.cashier_name || 'Unknown Cashier'}</td>
                      <td>{sale.branch_name || 'All Branches'}</td>
                      <td>{getSaleItemCount(sale)}</td>
                      <td>{peso(sale.subtotal)}</td>
                      <td>{peso(sale.discount)}</td>
                      <td>{peso(sale.total_amount)}</td>
                      <td>{getSalePaymentMethodLabel(sale.payment_method)}</td>
                      <td>
                        <StatusBadge text="Completed" tone="normal" />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ghost-action sales-history-action"
                          onClick={() => setSelectedSale(sale)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationControls
              currentPage={historyPage.currentPage}
              totalPages={historyPage.totalPages}
              totalItems={historyPage.totalCount}
              pageSize={historyPage.pageSize}
              onPageChange={(page) =>
                updateHistoryViewState({
                  currentPage: page,
                })
              }
              summaryLabel={recordsLabel}
            />
          </>
        )}
      </section>

      <SalesHistoryDetailsModal
        key={selectedSale?.id || 'sales-history-detail-closed'}
        sale={selectedSale}
        isOpen={Boolean(selectedSale)}
        onClose={() => setSelectedSale(null)}
      />
    </>
  )
}

export default SalesHistoryPanel
