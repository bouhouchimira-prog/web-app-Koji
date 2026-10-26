'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { useClientStore } from '@/store/clientStore';
import { supabase } from '@/lib/supabaseClient';
import { User, Lock, Bell, Loader2, Check } from 'lucide-react';

export default function SettingsPage() {
  const user = useClientStore((s) => s.user);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setCompany(user.company || '');
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({
        data: { name, company, phone },
      });
      if (err) throw err;
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      <Header title="Paramètres" subtitle="Gérez votre profil et vos préférences." />

      <div className="px-10 py-6 pb-12 max-w-3xl">
        {/* Profile section */}
        <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-[#F0F4FF] flex items-center justify-center text-[#1D5FE1]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">Profil</p>
              <p className="text-xs text-gray-500">Mettez à jour vos informations personnelles.</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-[#F0F4FF] border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1D5FE1]/30 focus:border-[#1D5FE1] transition-all outline-none text-gray-900 font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Société</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-4 py-3 bg-[#F0F4FF] border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1D5FE1]/30 focus:border-[#1D5FE1] transition-all outline-none text-gray-900 font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33 6 12 34 56 78"
                className="w-full px-4 py-3 bg-[#F0F4FF] border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1D5FE1]/30 focus:border-[#1D5FE1] transition-all outline-none text-gray-900 font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">Pour modifier votre email, contactez le support.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              {saved && (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                  <Check className="w-4 h-4" /> Enregistré
                </span>
              )}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D5FE1] hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-[#1D5FE1]/30 transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </form>
        </div>

        {/* Security section */}
        <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-[#F0F4FF] flex items-center justify-center text-[#1D5FE1]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">Sécurité</p>
              <p className="text-xs text-gray-500">Modifiez votre mot de passe pour sécuriser votre compte.</p>
            </div>
          </div>

          <button
            onClick={async () => {
              if (!user?.email) return;
              const { error: err } = await supabase.auth.resetPasswordForEmail(user.email);
              if (err) alert(err.message);
              else alert('Un email de réinitialisation a été envoyé à ' + user.email);
            }}
            className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
          >
            Réinitialiser le mot de passe
          </button>
        </div>

        {/* Notifications section */}
        <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-[#F0F4FF] flex items-center justify-center text-[#1D5FE1]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">Notifications</p>
              <p className="text-xs text-gray-500">Choisissez comment vous souhaitez être informé.</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Nouveau devis disponible', defaultChecked: true },
              { label: 'Rappel de signature', defaultChecked: true },
              { label: 'Message du conseiller', defaultChecked: true },
              { label: 'Newsletter mensuelle', defaultChecked: false },
            ].map((opt) => (
              <label key={opt.label} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 cursor-pointer">
                <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                <input type="checkbox" defaultChecked={opt.defaultChecked} className="h-4 w-4 accent-[#1D5FE1]" />
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
