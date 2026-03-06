import { useState, useEffect, useRef, useMemo, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccounts } from '../hooks/useAccounts';
import { useCreatePayment } from '../hooks/usePayments';
import { fxApi } from '../api/payments';
import { formatCurrency } from '../utils/formatters';
import type { Account, FxPreview } from '../types/payment.types';

function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

function AccountInput({
  label,
  value,
  onChange,
  accounts,
  disabled,
  placeholder,
  selectedAccount,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  accounts: Account[];
  disabled?: boolean;
  placeholder: string;
  selectedAccount?: Account;
}) {
  const inputId = useId();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        a.id.toLowerCase().includes(q) ||
        a.userId.toLowerCase().includes(q) ||
        a.currency.toLowerCase().includes(q),
    );
  }, [accounts, search]);

  function handleSelect(account: Account) {
    onChange(account.id);
    setSearch('');
    setOpen(false);
  }

  function handleInputChange(val: string) {
    setSearch(val);
    setOpen(true);

    const exact = accounts.find((a) => a.id === val);
    if (exact) {
      onChange(exact.id);
    } else if (value && val !== value) {
      onChange('');
    }
  }

  const displayValue = selectedAccount
    ? `${selectedAccount.userId} — ${selectedAccount.currency} (${formatCurrency(selectedAccount.balance, selectedAccount.currency)})`
    : '';

  return (
    <div ref={wrapperRef} className="relative">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      {selectedAccount && !open ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 flex justify-between items-center ${
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          }`}
          onClick={() => {
            if (!disabled) {
              setOpen(true);
              setSearch('');
            }
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpen(true);
              setSearch('');
            }
          }}
        >
          <span className="text-gray-900">{displayValue}</span>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 text-xs ml-2"
            onClick={(e) => {
              e.stopPropagation();
              if (disabled) return;
              onChange('');
              setSearch('');
              setOpen(true);
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <input
          id={inputId}
          type="text"
          className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
            disabled ? 'bg-gray-50 cursor-not-allowed text-gray-500' : ''
          }`}
          placeholder={placeholder}
          value={search}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          autoComplete="off"
        />
      )}

      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg">
          {filtered.map((a) => (
            <li
              key={a.id}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-brand-50 ${
                a.id === value ? 'bg-brand-50 font-medium' : ''
              }`}
              onClick={() => handleSelect(a)}
            >
              <div className="flex justify-between">
                <span className="text-gray-900">
                  {a.userId} — {a.currency}
                </span>
                <span className="text-gray-500 text-xs">
                  {formatCurrency(a.balance, a.currency)}
                </span>
              </div>
              <div className="text-xs text-gray-400 font-mono mt-0.5 truncate">{a.id}</div>
            </li>
          ))}
        </ul>
      )}

      {open && search && filtered.length === 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg px-3 py-3 text-sm text-gray-500">
          No accounts matching "{search}"
        </div>
      )}
    </div>
  );
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
  const hasAppliedDemoRef = useRef(false);

  const senderAccount = accounts?.find((a) => a.id === senderAccountId);
  const recipientAccount = accounts?.find((a) => a.id === recipientAccountId);

  // Pre-fill with demo data when accounts first load (e.g. seeded user_alice NGN → user_bob USD)
  useEffect(() => {
    if (
      hasAppliedDemoRef.current ||
      !accounts?.length ||
      senderAccountId ||
      recipientAccountId ||
      amount
    ) {
      return;
    }
    const withBalance = accounts.filter((a) => parseFloat(a.balance) > 0);
    const sender = withBalance.find((a) => a.currency === 'NGN') ?? withBalance[0];
    if (!sender) return;
    const recipient = accounts.find(
      (a) => a.id !== sender.id && a.currency !== sender.currency,
    );
    if (!recipient) return;
    hasAppliedDemoRef.current = true;
    setSenderAccountId(sender.id);
    setRecipientAccountId(recipient.id);
    setAmount('100');
  }, [accounts, senderAccountId, recipientAccountId, amount]);

  const recipientAccounts = useMemo(
    () =>
      accounts?.filter(
        (a) => a.id !== senderAccountId && a.currency !== senderAccount?.currency,
      ) ?? [],
    [accounts, senderAccountId, senderAccount?.currency],
  );

  const recipientAccountsForInput = senderAccount ? recipientAccounts : accounts ?? [];

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
  }, [senderAccountId, recipientAccountId, amount, senderAccount, recipientAccount]);

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
            <span className="text-white text-sm font-bold">&#10003;</span>
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
              hasAppliedDemoRef.current = false;
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
      <AccountInput
        label="Source Account"
        value={senderAccountId}
        onChange={(id) => {
          const nextSender = accounts?.find((a) => a.id === id);
          const nextRecipient = accounts?.find((a) => a.id === recipientAccountId);

          setSenderAccountId(id);
          if (
            !nextSender ||
            !nextRecipient ||
            nextRecipient.id === nextSender.id ||
            nextRecipient.currency === nextSender.currency
          ) {
            setRecipientAccountId('');
          }
          setQuote(null);
        }}
        accounts={accounts ?? []}
        disabled={accountsLoading}
        placeholder="Search by user ID, currency, or paste account UUID…"
        selectedAccount={senderAccount}
      />

      <AccountInput
        label="Recipient Account"
        value={recipientAccountId}
        onChange={(id) => {
          setRecipientAccountId(id);
          setQuote(null);
        }}
        accounts={recipientAccountsForInput}
        disabled={accountsLoading}
        placeholder="Search by user ID, currency, or paste account UUID…"
        selectedAccount={recipientAccount}
      />

      {!senderAccountId && (accounts?.length ?? 0) > 0 && (
        <p className="text-xs text-gray-500">
          Tip: select a source account to filter recipients to foreign-currency accounts.
        </p>
      )}

      {senderAccountId && recipientAccounts.length === 0 && (
        <p className="text-xs text-amber-600">
          No foreign-currency recipient accounts available for this sender.
        </p>
      )}

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

      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
          {submitError.message}
        </div>
      )}

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
