import { AssistantDemande } from "./AssistantDemande";

// Demande de devis avec l'assistant Koji (maquette PRO-13.5).
export const metadata = { title: "Demande de devis", robots: { index: false, follow: false } };

export default async function DemandePage({ params }) {
  const { slug } = await params;
  return <AssistantDemande slug={slug} />;
}
