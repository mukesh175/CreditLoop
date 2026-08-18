'use client';

import AppShell from './AppShell';
import { ShopProvider, useShop } from './ShopProvider';

function Inner({ children }) {
  const { shop } = useShop();
  return (
    <AppShell shop={shop} demoMode={shop?.demoMode}>
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
