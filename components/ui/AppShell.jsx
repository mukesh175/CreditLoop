'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BRAND } from '@/lib/config';
import Icon from './Icon';
import { apiFetch } from '@/lib/client/api';

const NAV = [
  { href: '/', label: 'Overview', icon: 'overview' },
  { href: '/returns', label: 'Returns', icon: 'returns' },
  { href: '/orders', label: 'Orders', icon: 'orders' },
  { href: '/credit', label: 'Credit', icon: 'credit' },
  { href: '/customers', label: 'Customers', icon: 'customers' },
  { href: '/campaigns', label: 'Campaigns', icon: 'campaigns' },
  { href: '/analytics', label: 'Analytics', icon: 'analytics' },
  { href: '/notifications', label: 'Notifications', icon: 'notifications', badgeKey: 'alerts' },
];

const SETTINGS_NAV = [
  { href: '/settings', label: 'General', icon: 'settings' },
  { href: '/settings/rules', label: 'Credit Rules', icon: 'rules' },
  { href: '/settings/notifications', label: 'Notifications', icon: 'notifications' },
  { href: '/settings/emails', label: 'Customer Emails', icon: 'email' },
  { href: '/settings/billing', label: 'Billing', icon: 'billing' },
  { href: '/settings/audit', label: 'Audit Log', icon: 'audit' },
];

/** "6 days ago" reads better than a timestamp for a freshness indicator. */
function timeAgo(date) {
  if (!date) return 'never';
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export default function AppShell({ children, shop, demoMode, badges = {}, onSynced }) {
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);

  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  async function resync() {
    setSyncing(true);
    try {
      await apiFetch('/api/onboarding', { method: 'POST', body: { action: 'sync' } });
      onSynced?.();
    } catch {
      // The Settings page reports sync problems in detail; the top bar stays quiet.
    } finally {
      setSyncing(false);
    }
  }

  const staleSync =
    shop?.lastSyncAt && Date.now() - new Date(shop.lastSyncAt).getTime() > 2 * 86_400_000;

  const renderLink = (item, sub = false) => (
    <Link
      key={item.href}
      href={item.href}
      className={`cl-nav-link${sub ? ' cl-nav-sub' : ''}${
        (sub ? pathname === item.href : isActive(item.href)) ? ' active' : ''
      }`}
    >
      {!sub && <Icon name={item.icon} />}
      <span>{item.label}</span>
      {item.badgeKey && badges[item.badgeKey] > 0 && (
        <span className="cl-nav-badge">{badges[item.badgeKey]}</span>
      )}
    </Link>
  );

  return (
    <div className="cl-shell">
      <aside className="cl-sidebar">
        <div className="cl-brand">
          <div className="cl-brand-mark">C</div>
          <div>
            <div className="cl-brand-name">{BRAND.name}</div>
            <div className="cl-brand-sub">Store credit retention</div>
          </div>
        </div>

        <nav aria-label="Main">
          <div className="cl-nav-section">Retention</div>
          {NAV.map((item) => renderLink(item))}

          <div className="cl-nav-section">Settings</div>
          {SETTINGS_NAV.map((item) => renderLink(item, true))}
        </nav>

        <div className="cl-sidebar-footer">
          <div className="cl-card" style={{ boxShadow: 'none', background: 'var(--cl-green-tint)' }}>
            <div className="cl-card-body py-3">
              <div className="cl-kpi-label mb-1">Plan</div>
              <div style={{ fontWeight: 650, color: 'var(--cl-navy)' }}>
                {shop?.plan ? shop.plan.charAt(0) + shop.plan.slice(1).toLowerCase() : '—'}
              </div>
              <Link href="/settings/billing" className="btn btn-cl-secondary btn-sm w-100 mt-2">
                Manage plan
              </Link>
            </div>
          </div>
        </div>
      </aside>

      <div className="cl-main">
        <header className="cl-topbar">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <span className="cl-store-chip">
              <span className={`cl-dot${staleSync ? ' cl-dot-warn' : ''}`} />
              {shop?.name || shop?.domain?.replace('.myshopify.com', '') || 'Store'}
            </span>
            <span className="cl-source-note">Last sync {timeAgo(shop?.lastSyncAt)}</span>
          </div>

          <button
            type="button"
            className="btn btn-cl-secondary btn-sm d-inline-flex align-items-center gap-2"
            onClick={resync}
            disabled={syncing}
          >
            <Icon name="sync" size={15} />
            {syncing ? 'Syncing…' : 'Re-sync'}
          </button>
        </header>

        <main className="cl-content">
          {demoMode && (
            <div className="cl-demo-banner mb-3" role="status">
              ⚠️ Demo data — these figures are generated for development and are not from your
              Shopify store.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
