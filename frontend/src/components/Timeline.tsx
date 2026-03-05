import type { StateHistoryEntry } from '../types/payment.types';
import { formatDate } from '../utils/formatters';
import { StatusBadge } from './StatusBadge';
import type { TransactionStatus } from '../types/payment.types';

interface Props {
  history: StateHistoryEntry[];
}

export function Timeline({ history }: Props) {
  if (!history.length) {
    return <p className="text-sm text-gray-500">No state history available.</p>;
  }

  return (
    <ol className="relative border-l border-gray-200 ml-3">
      {history.map((entry, idx) => (
        <li key={entry.id} className="mb-6 ml-6">
          <span className="absolute flex items-center justify-center w-6 h-6 rounded-full -left-3 ring-4 ring-white bg-white border border-gray-300">
            <span className="w-2 h-2 rounded-full bg-brand-500" />
          </span>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              {entry.fromState && (
                <>
                  <StatusBadge status={entry.fromState as TransactionStatus} size="sm" />
                  <span className="text-gray-400 text-sm">→</span>
                </>
              )}
              <StatusBadge status={entry.toState as TransactionStatus} size="sm" />
              {idx === history.length - 1 && (
                <span className="text-xs text-gray-400 font-medium">(current)</span>
              )}
            </div>

            <time className="text-xs text-gray-500">{formatDate(entry.timestamp)}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}
