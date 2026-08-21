'use client';

import AppShell from './AppShell';
import { ShopProvider, useShop } from './ShopProvider';
import { useApi } from '@/lib/client/useApi';

function Inner({ children }) {
  const { shop, reload } = useShop();
  // The alert count drives the sidebar badge, so it must reflect live data.
  const alerts = useApi('/api/analytics/overview?range=30d');

  return (
    <AppShell
      shop={shop}
      demoMode={shop?.demoMode}
      badges={{ alerts: alerts.data?.alerts?.length || 0 }}
      onSynced={() => {
        reload?.();
        alerts.reload?.();
      }}
    >
      {children}
    </AppShell>
  );
}

/** Standard page wrapper: shop context + shell. */
export default function Page({ children }) {
  return (
    <ShopProvider>
      <Inner>{children}</Inner>
    </ShopProvider>
  );
}
