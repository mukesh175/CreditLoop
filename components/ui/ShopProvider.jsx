'use client';

import { createContext, useContext } from 'react';
import { useApi } from '@/lib/client/useApi';

const ShopContext = createContext({ shop: null, entitlements: null, loading: true });

export function useShop() {
  return useContext(ShopContext);
}

/** Loads shop context once and shares it with every page in the shell. */
export function ShopProvider({ children }) {
  const { data, loading, error, reload } = useApi('/api/shop');
  return (
    <ShopContext.Provider
      value={{
        shop: data?.shop || null,
        entitlements: data?.entitlements || null,
        demoModeAvailable: Boolean(data?.demoModeAvailable),
        loading,
        error,
        reload,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}
