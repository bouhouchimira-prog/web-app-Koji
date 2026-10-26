'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { useClientStore } from '@/store/clientStore';
import { Loader2 } from 'lucide-react';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, authReady } = useClientStore();

  useEffect(() => {
    if (authReady && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [authReady, isAuthenticated, router]);

  if (!authReady || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
