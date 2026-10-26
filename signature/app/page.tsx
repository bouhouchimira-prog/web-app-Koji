'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { QuoteDetailView } from '@/components/features/QuoteDetailView';
import { Navbar } from "@/components/layout/Navbar";

// Plus de compte client, plus de connexion (26 oct, demande d'Amira) : ce
// site n'existe que pour ouvrir un devis par lien direct (?quoteId=...). Sans
// ce parametre, page vierge pour tout le monde — aucun contenu, aucune
// redirection vers un tableau de bord ou un ecran de connexion.
function HomeContent() {
  const searchParams = useSearchParams();

  const quoteId = searchParams?.get('quoteId');
  const email = searchParams?.get('email') || undefined;

  if (quoteId) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <main className="flex-1">
          <QuoteDetailView id={quoteId} email={email} />
        </main>
      </div>
    );
  }

  return <div className="min-h-screen bg-background" />;
}

export default function Home() {
  return (
    <Suspense fallback={<div />}>
      <HomeContent />
    </Suspense>
  );
}
