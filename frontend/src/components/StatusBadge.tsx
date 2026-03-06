import type { TransactionStatus } from '../types/payment.types';

const CONFIG: Record<TransactionStatus, { label: string; classes: string }> = {
  initiated:  { label: 'Initiated',  classes: 'bg-gray-100 text-gray-700 ring-gray-200' },
  processing: { label: 'Processing', classes: 'bg-yellow-100 text-yellow-800 ring-yellow-200' },
  completed:  { label: 'Completed',  classes: 'bg-green-100 text-green-800 ring-green-200' },
  failed:     { label: 'Failed',     classes: 'bg-red-100 text-red-800 ring-red-200' },
  reversed:   { label: 'Reversed',   classes: 'bg-slate-100 text-slate-700 ring-slate-200' },
  disputed:   { label: 'Disputed',  classes: 'bg-amber-100 text-amber-800 ring-amber-200' },
};

interface Props {
  status: TransactionStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const config = CONFIG[status] ?? CONFIG.initiated;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${sizeClass} ${config.classes}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'processing' ? 'animate-pulse bg-yellow-500' :
          status === 'completed'  ? 'bg-green-500' :
          status === 'failed'     ? 'bg-red-500' :
          status === 'reversed'   ? 'bg-slate-500' :
          status === 'disputed'   ? 'bg-amber-500' : 'bg-gray-400'
        }`}
      />
      {config.label}
    </span>
  );
}
