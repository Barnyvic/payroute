export type TransactionStatus =
  | 'initiated'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'reversed'
  | 'disputed';

export type EntryType = 'debit' | 'credit';

export interface Account {
  id: string;
  userId: string;
  currency: string;
  balance: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface FxQuote {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  sourceAmount: string;
  destinationAmount: string;
  expiresAt: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  providerReference: string | null;
  senderAccountId: string;
  senderAccount?: Account;
  recipientAccountId: string;
  recipientAccount?: Account;
  sourceCurrency: string;
  sourceAmount: string;
  destinationCurrency: string;
  destinationAmount: string;
  fxRate: string;
  fxQuoteId: string;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  accountId: string;
  currency: string;
  amount: string;
  entryType: EntryType;
  isReversal: boolean;
  createdAt: string;
}

export interface StateHistoryEntry {
  id: string;
  transactionId: string;
  fromState: string | null;
  toState: string;
  timestamp: string;
  metadata: Record<string, unknown> | null;
}

export interface TransactionDetail {
  transaction: Transaction;
  ledgerEntries: LedgerEntry[];
  stateHistory: StateHistoryEntry[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface FxPreview {
  rate: number;
  destinationAmount: string;
  expiresInSeconds: number;
}

export interface CreatePaymentPayload {
  senderAccountId: string;
  recipientAccountId: string;
  sourceCurrency: string;
  destinationCurrency: string;
  amount: number;
}

export interface PaymentStats {
  counts: Partial<Record<TransactionStatus, number>>;
  totalVolumeByStatus: Partial<Record<TransactionStatus, string>>;
  stuckCount: number;
  stuckThresholdMinutes: number;
}

export interface ListPaymentsParams {
  status?: TransactionStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}
