'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BRAND } from '@/lib/config';

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/returns', label: 'Returns' },
  { href: '/orders', label: 'Orders' },
  { href: '/credit', label: 'Credit' },
  { href: '/customers', label: 'Customers' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/notifications', label: 'Notifications' },
];

const SETTINGS_NAV = [
  { href: '/settings', label: 'General' },
  { href: '/settings/rules', label: 'Credit Rules' },
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/emails', label: 'Customer Emails' },
  { href: '/settings/billing', label: 'Billing' },
  { href: '/settings/audit', label: 'Audit Log' },
];

export default function AppShell({ children, shop, demoMode }) {
  const pathname = usePathname();
  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="cl-shell">
      <aside className="cl-sidebar">
        <div className="cl-brand">
          <div className="cl-brand-mark">C</div>
          <div>
            <div className="cl-brand-name">{BRAND.name}</div>
            <div style={{ fontSize: 11, color: 'var(--cl-muted)' }}>
              {shop?.domain?.replace('.myshopify.com', '') || 'Store'}
            </div>
          </div>
        </div>

        <nav aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`cl-nav-link${isActive(item.href) ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          ))}

          <div className="cl-nav-section">Settings</div>
          {SETTINGS_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`cl-nav-link cl-nav-sub${pathname === item.href ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="cl-main">
        {demoMode && (
          <div className="cl-demo-banner mb-3" role="status">
            ⚠️ Demo data — these figures are generated for development and are not from your
            Shopify store.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
