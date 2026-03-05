import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePayment } from '../hooks/usePayments';
import { StatusBadge } from './StatusBadge';
import { Timeline } from './Timeline';
import { formatCurrency, formatDate, truncateId } from '../utils/formatters';
import { paymentsApi } from '../api/payments';

function RefundButton({
  transactionId,
  onSuccess,
  isChargeback,
}: {
  transactionId: string;
  onSuccess: () => void;
  isChargeback?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = isChargeback ? 'Chargeback' : 'Refund / Reverse';
  const confirmMsg = isChargeback
    ? 'This is a COMPLETED transaction. Proceeding will debit the recipient and credit the sender (chargeback). Enter reason:'
    : 'Enter refund reason:';

  async function handleRefund() {
    const reason = window.prompt(confirmMsg);
    if (!reason) return;
    setLoading(true);
    setError(null);
    try {
      await paymentsApi.refund(transactionId, reason);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleRefund}
        disabled={loading}
        className="text-sm text-red-600 hover:text-red-700 border border-red-200 rounded px-3 py-1 disabled:opacity-50"
      >
        {loading ? 'Processing…' : label}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

function CopyableId({ id }: { id: string }) {
  const copy = () => navigator.clipboard.writeText(id).catch(() => {});
  return (
    <span
      className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded cursor-pointer hover:bg-gray-200"
      title="Click to copy"
      onClick={copy}
    >
      {id}
    </span>
  );
}

interface Props {
  id: string;
}

export function TransactionDetail({ id }: Props) {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = usePayment(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Loading transaction…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md">
        Error: {error?.message}
      </div>
    );
  }

  if (!data) return null;

  const { transaction: txn, ledgerEntries, stateHistory } = data;

  return (
    <div className="space-y-6">
      {}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          ← Back to transactions
        </button>
          <div className="flex gap-2">
            {(txn?.status === 'processing' || txn?.status === 'failed' || txn?.status === 'completed') && (
              <RefundButton
                transactionId={id}
                onSuccess={refetch}
                isChargeback={txn.status === 'completed'}
              />
            )}
            <button
              onClick={() => refetch()}
              className="text-sm text-brand-600 hover:text-brand-700"
            >
              Refresh
            </button>
          </div>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Transaction Detail</h1>
        <StatusBadge status={txn.status} />
      </div>

      {}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Payment Information</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-5">
          <Field label="Transaction ID" value={<CopyableId id={txn.id} />} />
          <Field
            label="Provider Reference"
            value={txn.providerReference ? <CopyableId id={txn.providerReference} /> : '—'}
          />
          <Field label="Status" value={<StatusBadge status={txn.status} />} />
          <Field
            label="Source Amount"
            value={formatCurrency(txn.sourceAmount, txn.sourceCurrency)}
          />
          <Field
            label="Destination Amount"
            value={formatCurrency(txn.destinationAmount, txn.destinationCurrency)}
          />
          <Field
            label="FX Rate"
            value={`1 ${txn.sourceCurrency} = ${parseFloat(txn.fxRate).toFixed(6)} ${txn.destinationCurrency}`}
          />
          <Field
            label="Sender Account"
            value={
              <span>
                {txn.senderAccount?.userId ?? truncateId(txn.senderAccountId)}{' '}
                <span className="text-gray-400">({txn.sourceCurrency})</span>
              </span>
            }
          />
          <Field
            label="Recipient Account"
            value={
              <span>
                {txn.recipientAccount?.userId ?? truncateId(txn.recipientAccountId)}{' '}
                <span className="text-gray-400">({txn.destinationCurrency})</span>
              </span>
            }
          />
          <Field label="Created" value={formatDate(txn.createdAt)} />
          {txn.completedAt && (
            <Field label="Completed" value={formatDate(txn.completedAt)} />
          )}
        </dl>
      </div>

      {}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Ledger Entries
          <span className="ml-2 text-xs text-gray-400 font-normal">
            (double-entry — ledger is source of truth)
          </span>
        </h2>
        {ledgerEntries.length === 0 ? (
          <p className="text-sm text-gray-500">No ledger entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Account</th>
                  <th className="pb-2 pr-4">Currency</th>
                  <th className="pb-2 pr-4 text-right">Amount</th>
                  <th className="pb-2 pr-4">Reversal</th>
                  <th className="pb-2">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ledgerEntries.map((entry) => (
                  <tr key={entry.id} className={entry.isReversal ? 'bg-amber-50' : ''}>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          entry.entryType === 'credit'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {entry.entryType.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-500">
                      <span title={entry.accountId}>{truncateId(entry.accountId)}</span>
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{entry.currency}</td>
                    <td
                      className={`py-2 pr-4 text-right font-mono font-medium tabular-nums ${
                        parseFloat(entry.amount) < 0 ? 'text-red-600' : 'text-green-700'
                      }`}
                    >
                      {parseFloat(entry.amount) >= 0 ? '+' : ''}
                      {formatCurrency(entry.amount, entry.currency)}
                    </td>
                    <td className="py-2 pr-4 text-gray-400 text-xs">
                      {entry.isReversal ? 'Yes' : '—'}
                    </td>
                    <td className="py-2 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(entry.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">State History</h2>
        <Timeline history={stateHistory} />
      </div>
    </div>
  );
}
