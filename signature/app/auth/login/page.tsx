'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Verify the per-chantier Identifiant + Mot de passe. The RPC returns the
      // matching quote id (or null). On success we open that devis directly —
      // the unguessable id authorizes viewing + signing (no account needed).
      const { data, error } = await supabase.rpc('login_with_access_code', {
        p_code: code.trim(),
        p_password: password,
      });

      if (error) throw error;

      const quoteId = typeof data === 'string' ? data : data?.toString();
      if (!quoteId || quoteId === 'null') {
        setError('Identifiant ou mot de passe incorrect.');
        return;
      }

      // Mark this quote as unlocked for THIS browser session only. The devis
      // view requires this flag, so simply sharing the link does not grant
      // access — the recipient must log in with the Identifiant + Mot de passe.
      // sessionStorage is per-tab and never travels in the URL.
      try {
        sessionStorage.setItem(`koji_access_${quoteId}`, '1');
      } catch {
        /* sessionStorage unavailable (private mode edge) — view will re-ask */
      }

      router.push(`/?quoteId=${quoteId}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 px-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
        <div className="text-center space-y-2">
          <div className="h-14 w-14 bg-[#0E172C] rounded-2xl mx-auto flex items-center justify-center mb-6 border border-gray-800 shadow-xl overflow-hidden">
            <img src="/koji-mark.svg" alt="Koji" className="w-full h-full object-contain p-2.5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Connexion</h1>
          <p className="text-sm text-gray-500">
            Entrez l’identifiant et le mot de passe reçus par message pour accéder à votre devis
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                Identifiant
              </label>
              <input
                id="code"
                name="code"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-3 bg-[#F0F4FF] border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1D5FE1]/30 focus:border-[#1D5FE1] transition-all outline-none text-gray-900 font-medium tracking-wide"
                placeholder="KOJI-XXXXXX"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="off"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#F0F4FF] border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1D5FE1]/30 focus:border-[#1D5FE1] transition-all outline-none text-gray-900 font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-3.5 bg-[#1D5FE1] hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-[#1D5FE1]/30 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Accéder à mon devis'}
          </button>
        </form>
      </div>
    </div>
  );
}
