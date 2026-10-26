'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { useClientStore } from '@/store/clientStore';
import { fetchClientTasksByEmail, type ChantierProgress } from '@/lib/quotesRepository';
import { HardHat, CheckCircle2, Circle, Loader2, ListChecks, Dot } from 'lucide-react';

export default function TasksPage() {
  const user = useClientStore((s) => s.user);
  const authReady = useClientStore((s) => s.authReady);

  const [groups, setGroups] = useState<ChantierProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady || !user?.email) return;
    let cancelled = false;
    setLoading(true);
    fetchClientTasksByEmail(user.email)
      .then((data) => { if (!cancelled) setGroups(data); })
      .catch(() => { if (!cancelled) setGroups([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authReady, user?.email]);

  // Global stats across all chantiers.
  const totalTasks = groups.reduce((s, g) => s + g.total, 0);
  const doneTasks = groups.reduce((s, g) => s + g.done, 0);
  const globalPct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
  const todoTasks = totalTasks - doneTasks;

  return (
    <div className="flex flex-col">
      <Header
        title="Suivi des travaux"
        subtitle="Suivez l'avancement de vos chantiers en temps réel."
      />

      <div className="px-10 py-6 pb-12 space-y-8">
        {/* Global stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCard label="Avancement global" value={`${globalPct}%`} accent="#1D5FE1" icon={<ListChecks className="w-4 h-4" />} />
          <StatCard label="Tâches terminées" value={`${doneTasks}`} accent="#10B981" icon={<CheckCircle2 className="w-4 h-4" />} />
          <StatCard label="Tâches restantes" value={`${todoTasks}`} accent="#F59E0B" icon={<Circle className="w-4 h-4" />} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <ChantierCard key={g.chantierId} group={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${accent}14`, color: accent }}
        >
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900 mt-3">{value}</p>
    </div>
  );
}

function ChantierCard({ group }: { group: ChantierProgress }) {
  const pct = Math.round(group.progress * 100);
  const finished = group.progress >= 1 && group.total > 0;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#F0F4FF] text-[#1D5FE1] flex items-center justify-center shrink-0">
          <HardHat className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-900 truncate">{group.reference}</p>
          <p className="text-xs text-gray-500">{group.done} / {group.total} tâches</p>
        </div>
        <span className="text-sm font-bold" style={{ color: finished ? '#10B981' : '#1D5FE1' }}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: finished ? '#10B981' : '#1D5FE1' }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1.5">
        {finished ? 'Travaux terminés 🎉' : `${pct}% réalisé`}
      </p>

      {/* Task list. Devis tasks (from the quote) show their room; manual
          checklist tasks show a done/▢ state — mirroring koji-main's "À faire". */}
      <div className="mt-4 border-t border-gray-100 divide-y divide-gray-50">
        {group.tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-3 py-3">
            {t.from_devis ? (
              <Dot className="w-5 h-5 text-[#1D5FE1] shrink-0" />
            ) : t.is_done ? (
              <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-gray-300 shrink-0" />
            )}
            <span
              className={`text-sm flex-1 ${
                !t.from_devis && t.is_done ? 'text-gray-400 line-through' : 'text-gray-900'
              }`}
            >
              {t.label}
            </span>
            {t.room_name && (
              <span className="text-xs text-gray-400 shrink-0">{t.room_name}</span>
            )}
          </div>
        ))}
        {group.tasks.length === 0 && (
          <p className="py-4 text-sm text-gray-400">Aucune tâche pour ce chantier.</p>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-gray-50/50 border border-gray-100 rounded-2xl py-16 text-center">
      <HardHat className="w-12 h-12 text-gray-300 mx-auto" />
      <p className="text-base font-bold text-gray-600 mt-4">Aucun travaux en cours</p>
      <p className="text-sm text-gray-400 mt-1">
        Le suivi de vos travaux apparaîtra ici dès que votre artisan l&apos;aura démarré.
      </p>
    </div>
  );
}
