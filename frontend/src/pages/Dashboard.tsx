import { TransactionList } from '../components/TransactionList';
import { usePaymentStats } from '../hooks/usePayments';
import type { PaymentStats } from '../types/payment.types';

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'red' | 'amber' | 'green' | 'blue';
}) {
  const accentClasses: Record<string, string> = {
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
  };

  const base = 'rounded-lg border p-4';
  const cls = accent ? `${base} ${accentClasses[accent]}` : `${base} bg-white border-gray-200`;

  return (
    <div className={cls}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs opacity-60">{sub}</p>}
    </div>
  );
}

function StuckAlert({ count, threshold }: { count: number; threshold: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3">
      <span className="mt-0.5 text-red-500 text-lg leading-none">⚠</span>
      <div>
        <p className="text-sm font-semibold text-red-700">
          {count} stuck payment{count !== 1 ? 's' : ''} detected
        </p>
        <p className="text-xs text-red-600 mt-0.5">
          PROCESSING for more than {threshold} minutes with no provider reference — manual review
          required. Use <span className="font-mono">GET /api/payments/stuck</span> for the full
          list.
        </p>
      </div>
    </div>
  );
}

function fmt(n: number | undefined) {
  return (n ?? 0).toLocaleString();
}

function fmtVolume(v: string | undefined) {
  if (!v) return '—';
  const num = parseFloat(v);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(2);
}

function StatsBar({ stats }: { stats: PaymentStats }) {
  const { counts, totalVolumeByStatus, stuckCount, stuckThresholdMinutes } = stats;

  const processing = counts.processing ?? 0;
  const completed = counts.completed ?? 0;
  const failed = counts.failed ?? 0;
  const reversed = counts.reversed ?? 0;
  const initiated = counts.initiated ?? 0;
  const total = processing + completed + failed + reversed + initiated;

  const completedVolume = totalVolumeByStatus.completed;
  const processingVolume = totalVolumeByStatus.processing;

  return (
    <div className="space-y-3">
      <StuckAlert count={stuckCount} threshold={stuckThresholdMinutes} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total" value={fmt(total)} />
        <StatCard
          label="Processing"
          value={fmt(processing)}
          sub={processingVolume ? `~${fmtVolume(processingVolume)} NGN in-flight` : undefined}
          accent={processing > 0 ? 'amber' : undefined}
        />
        <StatCard
          label="Completed"
          value={fmt(completed)}
          sub={completedVolume ? `${fmtVolume(completedVolume)} NGN settled` : undefined}
          accent="green"
        />
        <StatCard
          label="Failed"
          value={fmt(failed)}
          accent={failed > 0 ? 'red' : undefined}
        />
        <StatCard
          label="Reversed"
          value={fmt(reversed)}
          accent={reversed > 0 ? 'amber' : undefined}
        />
        <StatCard
          label="Stuck (>30 min)"
          value={stuckCount}
          accent={stuckCount > 0 ? 'red' : undefined}
          sub={stuckCount > 0 ? 'Needs attention' : 'None'}
        />
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = usePaymentStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Operations Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cross-border payments — live stats refresh every 30 s
        </p>
      </div>

      {statsLoading ? (
        <div className="h-20 flex items-center text-sm text-gray-400">Loading stats…</div>
      ) : stats ? (
        <StatsBar stats={stats} />
      ) : null}

      <TransactionList />
    </div>
  );
}
