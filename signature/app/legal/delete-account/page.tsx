export const metadata = {
  title: "Suppression de compte — Koji",
  description:
    "Procédure de suppression de votre compte Koji et des données associées.",
};

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-white text-gray-800">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900">
          Suppression de votre compte Koji
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Application : <strong>Koji</strong> — Éditée par Koji.
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Comment demander la suppression de votre compte
          </h2>
          <p>
            Vous pouvez demander la suppression de votre compte Koji et de
            l&apos;ensemble des données associées en suivant l&apos;une des deux
            procédures ci-dessous :
          </p>

          <div className="rounded-lg border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900">
              1. Depuis l&apos;application
            </h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Ouvrez l&apos;application Koji et connectez-vous.</li>
              <li>
                Accédez à <strong>Réglages</strong> → <strong>Compte</strong>.
              </li>
              <li>
                Appuyez sur <strong>Supprimer mon compte</strong> et confirmez.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900">2. Par e-mail</h3>
            <p className="mt-2">
              Envoyez une demande de suppression à l&apos;adresse suivante depuis
              l&apos;adresse e-mail associée à votre compte :
            </p>
            <p className="mt-2">
              <a
                href="mailto:firasmzoughi2001@gmail.com?subject=Suppression%20de%20compte%20Koji"
                className="font-medium text-blue-600 underline"
              >
                firasmzoughi2001@gmail.com
              </a>
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Votre demande sera traitée sous 30 jours.
            </p>
          </div>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Données supprimées
          </h2>
          <p>
            Lors de la suppression de votre compte, les données suivantes sont
            définitivement effacées :
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Vos informations de profil et de connexion.</li>
            <li>Vos chantiers, devis, tâches et documents associés.</li>
            <li>Les photos, pointages et rapports liés à votre activité.</li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Données conservées
          </h2>
          <p>
            Certaines données peuvent être conservées pour répondre à des
            obligations légales ou comptables (par exemple, les documents de
            facturation), pendant la durée imposée par la réglementation
            applicable. Passé ce délai, elles sont également supprimées.
          </p>
        </section>

        <p className="mt-12 text-sm text-gray-400">
          Dernière mise à jour : 13 juin 2026
        </p>
      </div>
    </main>
  );
}
