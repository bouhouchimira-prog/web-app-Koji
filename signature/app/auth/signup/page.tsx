'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            company,
            role: 'client',
          },
        },
      });

      if (signUpError) throw signUpError;

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setInfo('Compte créé. Vérifiez votre email pour confirmer votre inscription.');
        return;
      }

      router.push('/client');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 px-4 py-8">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
        <div className="text-center space-y-2">
          <div className="h-14 w-14 bg-[#0E172C] rounded-2xl mx-auto flex items-center justify-center mb-6 border border-gray-800 shadow-xl overflow-hidden">
            <img src="/koji-mark.svg" alt="Koji" className="w-full h-full object-contain p-2.5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Créer un compte</h1>
          <p className="text-sm text-gray-500">Votre espace client Koji — suivez et signez vos devis</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg">
              {error}
            </div>
          )}
          {info && (
            <div className="p-3 text-sm text-[#1D5FE1] bg-[#F0F4FF] border border-[#1D5FE1]/20 rounded-lg">
              {info}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nom complet
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-[#F0F4FF] border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1D5FE1]/30 focus:border-[#1D5FE1] transition-all outline-none text-gray-900 font-medium"
                placeholder="Marc-Antoine Lefebvre"
              />
            </div>

            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                Société
              </label>
              <input
                id="company"
                type="text"
                autoComplete="organization"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-4 py-3 bg-[#F0F4FF] border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1D5FE1]/30 focus:border-[#1D5FE1] transition-all outline-none text-gray-900 font-medium"
                placeholder="Luxe Horizon Agency"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#F0F4FF] border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1D5FE1]/30 focus:border-[#1D5FE1] transition-all outline-none text-gray-900 font-medium"
                placeholder="vous@exemple.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#F0F4FF] border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1D5FE1]/30 focus:border-[#1D5FE1] transition-all outline-none text-gray-900 font-medium"
                placeholder="••••••••"
              />
              <p className="text-xs text-gray-500 mt-1">Doit contenir au moins 6 caractères</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-3.5 bg-[#1D5FE1] hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-[#1D5FE1]/30 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Créer un compte'}
          </button>

          <div className="text-center text-sm text-gray-500">
            Vous avez déjà un compte ?{' '}
            <Link href="/auth/login" className="text-[#1D5FE1] hover:text-blue-800 font-bold transition-colors">
              Se connecter
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
