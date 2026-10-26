'use client';

import { useClientStore } from '@/store/clientStore';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const user = useClientStore((s) => s.user);

  const initials = (user?.name || user?.email || 'C')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'C';

  return (
    <header className="flex items-start justify-between gap-6 px-10 pt-8 pb-4 bg-white">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3 pl-2 shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900 leading-tight">{user?.name || 'Mon compte'}</p>
          <p className="text-xs text-gray-500 truncate max-w-[180px]">{user?.email || 'Client'}</p>
        </div>
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#1D5FE1] to-[#0E172C] flex items-center justify-center text-white font-bold text-sm shadow-sm">
          {initials}
        </div>
      </div>
    </header>
  );
}
