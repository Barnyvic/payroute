import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';

const NAV = [
  { href: '/', label: 'Transactions' },
  { href: '/payments/new', label: 'New Payment' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      {}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-8">
          <span className="font-bold text-lg text-brand-600 tracking-tight">
            PayRoute
          </span>
          <nav className="flex gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto text-xs text-gray-400">Operations Dashboard</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
