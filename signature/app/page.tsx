'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { QuoteDetailView } from '@/components/features/QuoteDetailView';
import { Navbar } from "@/components/layout/Navbar";

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const quoteId = searchParams?.get('quoteId');
  const email = searchParams?.get('email') || undefined;

  // If quoteId exists, render the Quote Detail View DIRECTLY
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

  // If no quoteId, redirect to Client Dashboard
  useEffect(() => {
    router.replace('/client');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Chargement de votre espace Koji Client...</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div />}>
      <HomeContent />
    </Suspense>
  );
}
