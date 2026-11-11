import { DM_Sans } from '../../fonts';
import { EndCta, PARTICULIER, SiteFooter, SiteHeader } from '../SiteParts';
import { ContactForm } from './ContactForm';
import '../landing.css';

// SITE-06 (maquette « KOJI Pro pages ») : Contact et démonstration,
// getkoji.io/entreprise/contact. Une page pour trois besoins : poser une
// question, voir une démonstration, faire reprendre son existant.
// Adresse affichée : contact@getkoji.io, la seule boîte qui existe (la
// maquette prévoit aide@ et pro@, à créer). Pas d'outil de prise de
// créneau : « Choisir un créneau » ouvre le formulaire en mode
// démonstration ; « Envoyer un fichier » ouvre un e-mail, pour pouvoir
// joindre le fichier.
const CONTACT_MAIL = 'contact@getkoji.io';
const FICHIER = `mailto:${CONTACT_MAIL}?subject=${encodeURIComponent('Reprendre mon existant dans Koji')}&body=${encodeURIComponent("Bonjour,\n\nJe joins mon fichier (Excel, export de mon ancien logiciel ou bibliothèque de prix).\nMétier :\nOutil actuel :\n")}`;

export function ContactPage() {
  return (
    <div className={`lp ${DM_Sans.variable}`}>
      <SiteHeader page="metier" />

      <section className="lp-pgh">
        <div>
          <span className="lp-ey">Contact</span>
          <h1>Parlons de votre activité</h1>
          <p>Une question, une démonstration, un fichier à reprendre ? Un humain répond du lundi au samedi.</p>
        </div>
      </section>

      <section className="lp-cto">
        <ContactForm />
        <div className="lp-cs">
          <div className="lp-card">
            <b>Démonstration en 20 minutes</b>
            <p>En visio, avec votre devis en cours : on le refait ensemble dans Koji.</p>
            <a className="lp-sec" href="?objet=demonstration#ecrire">Choisir un créneau</a>
          </div>
          <div className="lp-card">
            <b>Reprendre votre existant</b>
            <p>Fichier Excel, ancien logiciel, bibliothèque de prix : envoyez-le, on le charge.</p>
            <a className="lp-sec" href={FICHIER}>Envoyer un fichier</a>
          </div>
          <div className="lp-card">
            <b>Aide en ligne</b>
            <p>Réponses immédiates dans l'application, par Koji ou par un humain.</p>
            <a className="lp-sec" href="/aide">Ouvrir l'aide</a>
          </div>
          <div className="lp-card lp-cc">
            <b>Koji</b>
            <span>Paris · <a href={`mailto:${CONTACT_MAIL}`} className="lp-ul">{CONTACT_MAIL}</a></span>
            <span>Particulier avec un projet ? <a href={PARTICULIER} className="lp-ul">Koji Client</a></span>
          </div>
        </div>
      </section>

      <EndCta />
      <SiteFooter page="metier" />
    </div>
  );
}
