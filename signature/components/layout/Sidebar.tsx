'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileText, MessageSquare, Settings, LogOut, HardHat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientStore } from '@/store/clientStore';

const navItems = [
  { href: '/client', label: 'Devis', icon: FileText, match: ['/client', '/client/quotes'] },
  { href: '/client/tasks', label: 'Suivi travaux', icon: HardHat, match: ['/client/tasks'] },
  { href: '/client/messages', label: 'Messages', icon: MessageSquare, match: ['/client/messages'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useClientStore((s) => s.logout);
  const user = useClientStore((s) => s.user);

  const initials = (user?.name || user?.email || 'C')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'C';

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-[#F0F4FF] h-screen sticky top-0">
      <div className="px-6 pt-8 pb-10">
        <Link href="/client" className="flex items-center gap-3">
          <div className="h-11 w-11 bg-[#0E172C] rounded-xl flex items-center justify-center shadow-md overflow-hidden">
            <img src="/koji-mark.svg" alt="Koji" className="w-full h-full object-contain p-2" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">Koji Client</p>
            <p className="text-xs text-gray-500">Espace personnel</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.match.some((m) => pathname === m || pathname?.startsWith(m + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors',
                active
                  ? 'bg-[#0E172C] text-white shadow-md'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-6 space-y-1 border-t border-gray-200/60 pt-4">
        {user && (
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <div className="h-9 w-9 rounded-full bg-[#1D5FE1] text-white flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user.name || 'Mon compte'}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
        )}
        <Link
          href="/client/settings"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-900 transition-colors"
        >
          <Settings className="w-5 h-5" />
          Paramètres
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}
