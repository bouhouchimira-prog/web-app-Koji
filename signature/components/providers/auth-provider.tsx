'use client';

import { useEffect } from 'react';
import { useClientStore } from '@/store/clientStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initAuth = useClientStore((s) => s.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return <>{children}</>;
}
