import { redirect } from 'next/navigation';

// The devis list lives on the dashboard (/client). This route used to render a
// separate table from stale mock data (quote.projectTitle / issuedDate / …),
// which no longer matches the real quote shape and was not linked anywhere.
// Redirect to the canonical list so any old bookmark still lands somewhere real.
export default function QuotesPage() {
  redirect('/client');
}
