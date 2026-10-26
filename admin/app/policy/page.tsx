import React from 'react';

export const metadata = {
  title: 'Règles de confidentialité - Koji',
  description: 'Politique de confidentialité de l\'application Koji',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pt-10 px-4 md:px-8 pb-10">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Règles de confidentialité</h1>
        <p className="text-gray-600 mb-8">
          Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Introduction</h2>
          <p className="text-gray-600">
            Bienvenue sur Koji. La protection de vos données personnelles et de vos informations professionnelles est notre priorité. 
            Cette politique explique quelles données nous collectons via notre application mobile (Koji) et comment nous les utilisons 
            pour vous fournir nos services de gestion (devis, facturation, plannings, fournitures, etc.).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Informations que nous collectons</h2>
          
          <h3 className="text-xl font-medium text-gray-800 mt-4 mb-2">2.1 Informations fournies par l'utilisateur</h3>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li><strong>Données de profil et d'authentification :</strong> Adresse e-mail, nom, et informations de connexion (via Google ou e-mail).</li>
            <li><strong>Données professionnelles :</strong> Clients, coordonnées, listes de fournitures, prix et paramètres de l'entreprise.</li>
            <li><strong>Documents générés :</strong> Devis, factures, et signatures électroniques intégrées à l'application.</li>
          </ul>

          <h3 className="text-xl font-medium text-gray-800 mt-4 mb-2">2.2 Autorisations de l'appareil</h3>
          <p className="text-gray-600 mb-2">L'application peut vous demander l'accès à certaines fonctionnalités de votre appareil pour fonctionner correctement :</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li><strong>Appareil photo et Galerie (Photos) :</strong> Utilisés pour ajouter une photo de profil, ou numériser/attacher des documents aux devis et fournitures.</li>
            <li><strong>Stockage et Fichiers :</strong> Nécessaires pour générer, sauvegarder et exporter vos devis et autres documents au format PDF.</li>
            <li><strong>Réseau et Internet :</strong> Pour synchroniser vos données en temps réel et assurer des sauvegardes saines dans le cloud (via notre infrastructure sécurisée Supabase).</li>
            <li><strong>Applications de communication :</strong> L'application peut interagir avec vos applications de messagerie (WhatsApp, SMS, E-mail) avec votre autorisation explicite, uniquement lorsque vous choisissez de partager un PDF ou un devis avec un client.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Utilisation de vos informations</h2>
          <p className="text-gray-600 mb-2">Nous utilisons vos informations aux fins suivantes :</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li><strong>Fonctionnalité principale :</strong> Générer vos documents (devis, export PDF) et les gérer efficacement.</li>
            <li><strong>Synchronisation hors-ligne/en-ligne :</strong> Vous permettre de travailler partout et d'avoir vos données sauvegardées.</li>
            <li><strong>Personnalisation :</strong> Adapter l'affichage, les plannings et les tarifs à votre entreprise.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Partage de vos informations</h2>
          <p className="text-gray-600 mb-2">Nous sommes stricts sur la confidentialité :</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li><strong>Aucune revente de données :</strong> Vos informations professionnelles, listes de clients, et devis restent confidentiels et ne sont ni vendus ni loués à des tiers.</li>
            <li><strong>Prestataires back-end :</strong> Vos données sont stockées de manière sécurisée (technologie Supabase/PostgreSQL) avec des protocoles de sécurité robustes pour assurer le bon fonctionnement de l'application.</li>
            <li><strong>Partage volontaire :</strong> Vos données ne sont partagées avec d'autres parties (ex: vos clients) que lorsque vous déclenchez activement l'envoi d'un message, d'un e-mail, ou d'un PDF à partir de l'application.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Sécurité et Conservation</h2>
          <p className="text-gray-600">
            Nous mettons en œuvre des mesures de sécurité pour protéger vos informations professionnelles contre tout accès ou altération non autorisés. 
            Vos données sont conservées de manière sécurisée tant que votre compte est actif ou tant que cela est nécessaire pour vous fournir le service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Vos droits d'accès et de suppression</h2>
          <p className="text-gray-600">
            Vous conservez le contrôle total de vos données. Vous pouvez y accéder, les modifier, ou demander la suppression définitive de votre compte et de toutes vos informations à tout moment depuis les paramètres de l'application ou en nous contactant.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Contact</h2>
          <p className="text-gray-600">
            Pour toute question relative à cette politique de confidentialité ou concernant vos données, veuillez contacter notre équipe d'assistance via l'application Koji.
          </p>
        </section>
      </div>
    </div>
  );
}
