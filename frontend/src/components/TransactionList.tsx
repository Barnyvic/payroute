import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaymentList } from '../hooks/usePayments';
import { StatusBadge } from './StatusBadge';
import { formatCurrency, formatDate, truncateId } from '../utils/formatters';
import type { TransactionStatus, ListPaymentsParams } from '../types/payment.types';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'reversed', label: 'Reversed' },
];

export function TransactionList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ListPaymentsParams>({ page: 1, limit: 20 });

  const { data, isLoading, isError, error } = usePaymentList(filters);

  function setFilter(updates: Partial<ListPaymentsParams>) {
    setFilters((f) => ({ ...f, ...updates, page: 1 }));
  }

  const transactions = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      {}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select
            className="border border-gray-300 rounded-md text-sm px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filters.status ?? ''}
            onChange={(e) =>
              setFilter({ status: (e.target.value as TransactionStatus) || undefined })
            }
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input
            type="date"
            className="border border-gray-300 rounded-md text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filters.startDate ?? ''}
            onChange={(e) => setFilter({ startDate: e.target.value || undefined })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input
            type="date"
            className="border border-gray-300 rounded-md text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filters.endDate ?? ''}
            onChange={(e) => setFilter({ endDate: e.target.value || undefined })}
          />
        </div>

        {(filters.status || filters.startDate || filters.endDate) && (
          <button
            onClick={() => setFilters({ page: 1, limit: 20 })}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}

        <div className="ml-auto text-sm text-gray-500">
          {pagination && `${pagination.total} total`}
        </div>
      </div>

      {}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Reference', 'Sender', 'Recipient', 'Source Amount', 'Dest Amount', 'FX Rate', 'Status', 'Created'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    Loading transactions…
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-red-500">
                    Error: {error?.message}
                  </td>
                </tr>
              )}
              {!isLoading && !isError && transactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    No transactions found.
                  </td>
                </tr>
              )}
              {transactions.map((txn) => (
                <tr
                  key={txn.id}
                  onClick={() => navigate(`/payments/${txn.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                    <span title={txn.id}>{truncateId(txn.id)}</span>
                    {txn.providerReference && (
                      <div className="text-gray-400 text-xs" title={txn.providerReference}>
                        {truncateId(txn.providerReference)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {txn.senderAccount?.userId ?? truncateId(txn.senderAccountId)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {txn.recipientAccount?.userId ?? truncateId(txn.recipientAccountId)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium">
                    {formatCurrency(txn.sourceAmount, txn.sourceCurrency)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium">
                    {formatCurrency(txn.destinationAmount, txn.destinationCurrency)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap tabular-nums">
                    {parseFloat(txn.fxRate).toFixed(6)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={txn.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                    {formatDate(txn.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
