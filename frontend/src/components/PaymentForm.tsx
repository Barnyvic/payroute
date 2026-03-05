import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccounts } from '../hooks/useAccounts';
import { useCreatePayment } from '../hooks/usePayments';
import { fxApi } from '../api/payments';
import { formatCurrency } from '../utils/formatters';
import type { Account, FxPreview } from '../types/payment.types';

function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function PaymentForm() {
  const navigate = useNavigate();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { mutateAsync: createPayment, isPending, error: submitError } = useCreatePayment();

  const [senderAccountId, setSenderAccountId] = useState('');
  const [recipientAccountId, setRecipientAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<FxPreview | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [successTxnId, setSuccessTxnId] = useState<string | null>(null);

  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());

  const senderAccount = accounts?.find((a) => a.id === senderAccountId);
  const recipientAccount = accounts?.find((a) => a.id === recipientAccountId);

  const ngnAccounts = accounts?.filter((a) => a.currency === 'NGN') ?? [];
  const recipientAccounts =
    accounts?.filter(
      (a) => a.id !== senderAccountId && a.currency !== senderAccount?.currency,
    ) ?? [];

  
  useEffect(() => {
    if (!senderAccount || !recipientAccount || !amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const preview = await fxApi.getPreview(
          senderAccount.currency,
          recipientAccount.currency,
          parseFloat(amount),
        );
        setQuote(preview);
      } catch (err: any) {
        setQuoteError(err.message || 'Could not fetch FX rate');
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [senderAccountId, recipientAccountId, amount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!senderAccount || !recipientAccount || !amount) return;

    try {
      const txn = await createPayment({
        payload: {
          senderAccountId,
          recipientAccountId,
          sourceCurrency: senderAccount.currency,
          destinationCurrency: recipientAccount.currency,
          amount: parseFloat(amount),
        },
        idempotencyKey: idempotencyKeyRef.current,
      });
      setSuccessTxnId(txn.id);
    } catch {
      
      
      idempotencyKeyRef.current = generateIdempotencyKey();
    }
  }

  if (successTxnId) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
            <span className="text-white text-sm font-bold">✓</span>
          </div>
          <h2 className="text-lg font-semibold text-green-800">Payment Submitted</h2>
        </div>
        <p className="text-sm text-green-700">
          Your payment is being processed. Transaction ID:
        </p>
        <code className="block text-xs bg-white border border-green-200 rounded px-3 py-2 font-mono text-gray-800">
          {successTxnId}
        </code>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/payments/${successTxnId}`)}
            className="px-4 py-2 bg-brand-500 text-white rounded-md text-sm font-medium hover:bg-brand-600"
          >
            View Transaction
          </button>
          <button
            onClick={() => {
              setSuccessTxnId(null);
              setSenderAccountId('');
              setRecipientAccountId('');
              setAmount('');
              setQuote(null);
              idempotencyKeyRef.current = generateIdempotencyKey();
            }}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            New Payment
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      {}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Source Account
        </label>
        <select
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={senderAccountId}
          onChange={(e) => {
            setSenderAccountId(e.target.value);
            setRecipientAccountId('');
            setQuote(null);
          }}
          disabled={accountsLoading}
        >
          <option value="">Select source account…</option>
          {accounts?.map((a: Account) => (
            <option key={a.id} value={a.id}>
              {a.userId} — {a.currency} (Balance: {formatCurrency(a.balance, a.currency)})
            </option>
          ))}
        </select>
      </div>

      {}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Recipient Account
        </label>
        <select
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={recipientAccountId}
          onChange={(e) => {
            setRecipientAccountId(e.target.value);
            setQuote(null);
          }}
          disabled={!senderAccountId}
        >
          <option value="">Select recipient account…</option>
          {recipientAccounts.map((a: Account) => (
            <option key={a.id} value={a.id}>
              {a.userId} — {a.currency}
            </option>
          ))}
        </select>
        {senderAccountId && recipientAccounts.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">
            No foreign-currency recipient accounts available.
          </p>
        )}
      </div>

      {}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Amount ({senderAccount?.currency ?? 'source currency'})
        </label>
        <div className="relative">
          <input
            type="number"
            required
            min="0.01"
            step="0.01"
            className="w-full border border-gray-300 rounded-md px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {senderAccount && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
              {senderAccount.currency}
            </span>
          )}
        </div>
        {senderAccount && amount && parseFloat(amount) > parseFloat(senderAccount.balance) && (
          <p className="text-xs text-red-600 mt-1">
            Exceeds available balance: {formatCurrency(senderAccount.balance, senderAccount.currency)}
          </p>
        )}
      </div>

      {}
      {(quoteLoading || quote || quoteError) && (
        <div
          className={`rounded-md p-4 text-sm ${
            quoteError
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-blue-50 border border-blue-200'
          }`}
        >
          {quoteLoading && (
            <span className="text-blue-600">Fetching FX rate…</span>
          )}
          {quoteError && <span>{quoteError}</span>}
          {!quoteLoading && !quoteError && quote && recipientAccount && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Exchange Rate</span>
                <span className="font-semibold text-gray-900">
                  1 {senderAccount?.currency} = {quote.rate} {recipientAccount.currency}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Recipient Gets</span>
                <span className="text-lg font-bold text-blue-700">
                  {formatCurrency(quote.destinationAmount, recipientAccount.currency)}
                </span>
              </div>
              <div className="text-xs text-gray-400 text-right">
                Quote valid for ~{quote.expiresInSeconds}s
              </div>
            </div>
          )}
        </div>
      )}

      {}
      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
          {submitError.message}
        </div>
      )}

      {}
      <button
        type="submit"
        disabled={isPending || !senderAccountId || !recipientAccountId || !amount || quoteLoading}
        className="w-full py-2.5 px-4 bg-brand-500 text-white rounded-md font-medium text-sm hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Processing…' : 'Submit Payment'}
      </button>
    </form>
  );
}
