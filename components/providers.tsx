'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { ViewMode, PeriodFilter } from '@/lib/types';
import { getStoredMode, setStoredMode, resetAllStorage, STORAGE_KEYS, getWishlist, toggleWishlist as toggleWishlistUtil } from '@/lib/utils';

interface AuthUser {
  userId: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
}

interface AppContextType {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  periodFilter: PeriodFilter;
  setPeriodFilter: (period: PeriodFilter) => void;
  reset: () => void;
  mounted: boolean;
  isAuthenticated: boolean;
  authUser: AuthUser | null;
  wishlist: string[];
  toggleWishlist: (slug: string) => boolean;
  isInWishlist: (slug: string) => boolean;
  refreshWishlist: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within Providers');
  return context;
}

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [mode, setModeState] = useState<ViewMode>('pro');
  const [periodFilter, setPeriodFilterState] = useState<PeriodFilter>('toutes');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    setModeState(getStoredMode());
    setWishlist(getWishlist());
    const storedPeriod = localStorage.getItem(STORAGE_KEYS.PERIOD);
    if (storedPeriod) setPeriodFilterState(storedPeriod as PeriodFilter);
    
    // Check auth token
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1])) as AuthUser;
        setAuthUser(payload);
      } catch {
        setAuthUser(null);
      }
    }
  }, []);

  const setMode = (newMode: ViewMode) => {
    setModeState(newMode);
    setStoredMode(newMode);
  };

  const setPeriodFilter = (period: PeriodFilter) => {
    setPeriodFilterState(period);
    localStorage.setItem(STORAGE_KEYS.PERIOD, period);
  };

  const reset = () => {
    resetAllStorage();
    setModeState('pro');
    setPeriodFilterState('toutes');
  };

  const toggleWishlist = useCallback((slug: string): boolean => {
    const { wishlist: updated, added } = toggleWishlistUtil(slug);
    setWishlist(updated);
    return added;
  }, []);

  const isInWishlist = useCallback((slug: string): boolean => {
    return wishlist.includes(slug);
  }, [wishlist]);

  const refreshWishlist = useCallback(() => {
    setWishlist(getWishlist());
  }, []);

  const isAuthenticated = !!authUser;

  return (
    <AppContext.Provider value={{ 
      mode, setMode, periodFilter, setPeriodFilter, reset, mounted, 
      isAuthenticated, authUser, wishlist, toggleWishlist, isInWishlist, refreshWishlist
    }}>
      {children}
    </AppContext.Provider>
  );
}
