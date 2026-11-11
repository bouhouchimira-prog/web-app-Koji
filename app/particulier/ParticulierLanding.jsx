import KojiWordmark from '../../components/KojiWordmark';
import { DM_Sans, Shippori } from '../fonts';
import './landing.css';

// SITE-02 (maquette « KOJI Pro pages ») : page d'accueil publique pour les
// particuliers, sur getkoji.io/particulier. Univers Client : marine, sable,
// riz, titres en Shippori Mincho. Une seule action : décrire son projet.
//
// Texte de la maquette, publié tel quel (décision d'Amira du 11 nov., y
// compris « entreprises vérifiées » et ses quatre contrôles). Un seul écart
// voulu : aucun prix recommandé n'est montré ni promis au particulier
// (décision du 10 nov.). La carte « Prix recommandé Koji 6 000 € » devient
// le projet décrit par Koji, la ligne « Écart au prix recommandé » de la
// comparaison disparaît, et la question « Le prix recommandé, c'est le prix
// final ? » devient « Qui fixe le prix ? ».
//
// Page rendue côté serveur, sans JavaScript (référencement).

const DECRIRE = '/login?type=particulier';
const RETROUVER = '/login?type=particulier';
const ENTREPRISE = '/entreprise';
const CONTACT = 'mailto:contact@getkoji.io';

function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}

const TRUST = [
  ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'Entreprises vérifiées', 'SIREN actif, assurance décennale à jour, avis de vrais chantiers.'],
  ['M6 3h9l4 4v14H6zM9 12h6M9 16h6', 'Un projet bien décrit', 'Koji détaille vos travaux avant les propositions : les devis se comparent poste par poste.'],
  ['M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3', 'Votre numéro protégé', "Transmis seulement à l'entreprise avec laquelle vous confirmez un rendez-vous."],
  ['M8 3h8v18H8zM11 18h2', 'Tout sur votre téléphone', 'Devis, signature, photos du chantier, paiements, au même endroit.'],
];

const STEPS = [
  ['Décrivez', "Vos travaux en quelques phrases et des photos. Koji pose les questions qu'un artisan poserait, et prépare le détail des travaux."],
  ['Recevez', "Jusqu'à trois propositions d'entreprises vérifiées, comparées sur le prix, les avis, les dates et la visite."],
  ['Choisissez et suivez', 'Signez le devis en ligne, suivez le chantier en photos, payez par étapes, gardez tous les documents.'],
];

// Exemple de comparaison : ce sont les prix des devis des entreprises.
const COMPARE_HEAD = ['ABL Expert Renov', 'Rénov Est (exemple)', 'Atelier Bain (exemple)'];
const COMPARE = [
  { label: 'Prix TTC', values: ['6 034,82 €', '5 650,00 €', '6 900,00 €'], strong: true },
  { label: 'Avis vérifiés', values: ['4,8 · 27 avis', '4,5 · 9 avis', '4,9 · 41 avis'] },
  { label: 'Début et durée', values: ['début le 12 nov. · 18 jours', 'janvier · 3 semaines', 'début le 20 nov. · 15 jours'] },
  { label: 'Visite', values: ['visite faite', 'visite à prévoir', 'visite faite'] },
  { label: 'Assurance décennale', values: ['vérifiée', 'vérifiée', 'vérifiée'] },
];

const DURING = [
  ['Photos « après » à chaque étape', "Vous voyez l'avancement sans être sur place."],
  ['Paiement par étapes', 'Acompte, situation, solde : chaque montant est lié à ce qui est fait.'],
  ['Un problème ? Signalez-le', "Photo et message ; l'entreprise répond, et cela devient une réserve à lever avant la fin."],
  ['Fin de chantier', 'Procès-verbal, garanties, factures : tout reste téléchargeable, même des années après.'],
];

const VERIFIED = [
  ['SIREN actif', 'registre national des entreprises', 'SIREN actif'],
  ['Assurance décennale en cours', "attestation datée, revérifiée à l'échéance", 'Décennale en cours'],
  ['Identité du dirigeant', "pièce vérifiée à l'inscription", 'Identité du dirigeant'],
  ['Avis de vrais chantiers', "un avis par chantier terminé sur Koji, jamais d'avis libre", 'Avis de vrais chantiers'],
];

const FAQ = [
  ['Combien ça coûte ?', "Rien pour vous. Les entreprises paient Koji pour les chantiers qu'elles trouvent. Le prix du devis est celui de l'entreprise, sans commission ajoutée."],
  ['Qui fixe le prix ?', 'Chaque entreprise, dans son devis. Koji ne fixe pas de prix : il décrit vos travaux de la même façon pour toutes, et vous comparez leurs propositions.'],
  ['Qui voit mon numéro de téléphone ?', 'Personne avant que vous confirmiez un rendez-vous avec une entreprise. Elle seule le reçoit.'],
  ["Et si je change d'avis après la signature ?", 'Pour un devis signé à distance, vous avez 14 jours pour vous rétracter sans motif ; le formulaire est dans vos documents.'],
  ['Koji fait-il les travaux ?', "Non. Koji met en relation et outille le chantier ; le contrat est entre vous et l'entreprise, qui reste responsable des travaux et de ses garanties."],
  ['Mon projet est petit, ça vaut le coup ?', 'Oui : une fuite, une prise, une porte. Les petits chantiers trouvent vite preneur près de chez vous.'],
];

export function ParticulierLanding() {
  return (
    <div className={`lc ${DM_Sans.variable} ${Shippori.variable}`}>
      <header className="lc-h">
        <a href="/" className="lc-w" aria-label="Koji, accueil"><KojiWordmark height={16} /></a>
        <nav aria-label="Navigation principale">
          <a href="#lc-steps">Comment ça marche</a>
          <a href="#lc-ver">Entreprises vérifiées</a>
          <a href="#lc-faq">Questions</a>
        </nav>
        <a href={ENTREPRISE} className="lc-pro">Vous êtes une entreprise ?</a>
        <a href={RETROUVER} className="lc-in">Retrouver mon projet</a>
        <a href={DECRIRE} className="lc-b">Décrire mon projet</a>
      </header>

      {/* Ouverture : la promesse, et la preuve à côté (l'assistant, puis le
          projet tel que les entreprises le recevront). */}
      <section className="lc-hero">
        <div className="lc-hl">
          <span className="lc-ey">Pour les particuliers</span>
          <h1>
            Décrivez vos travaux.<span className="lc-dk"><br />Recevez un prix juste, et des entreprises vérifiées.</span>
            <span className="lc-ph"> Recevez un prix juste.</span>
          </h1>
          <p>
            <span className="lc-dk">Koji vous pose les bonnes questions, prépare le détail de vos travaux, puis transmet votre projet à des entreprises près de chez vous. Gratuit, sans engagement.</span>
            <span className="lc-ph">Des entreprises vérifiées près de chez vous. Gratuit, sans engagement.</span>
          </p>
          <a href={DECRIRE} className="lc-b big">Décrire mon projet</a>
          <small>
            5 minutes, avec des photos.<span className="lc-dk"> Votre numéro n'est jamais vendu.</span>
          </small>
        </div>
        <div className="lc-hv">
          <div className="lc-chat lc-dk">
            <div className="lc-ct">
              <b>Votre projet</b>
              <span>salle de bain · Paris 10e</span>
            </div>
            <div className="me">Je veux remplacer ma baignoire par une douche à l'italienne. La salle de bain fait 5,8 m², au 4e sans ascenseur.</div>
            <div className="kj">
              <b>Koji</b>
              Deux questions pour que les entreprises chiffrent juste : la faïence murale est-elle à refaire, et l'évacuation est-elle au sol ou dans le mur ?
            </div>
            <div className="me">Faïence à refaire sur deux murs. Évacuation au sol je crois.</div>
            <div className="lc-in2">
              <span>Répondre…</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            </div>
          </div>
          {/* À la place du « Prix recommandé Koji » de la maquette. */}
          <div className="lc-price">
            <span>Votre projet, prêt à être envoyé</span>
            <b>Salle de bain, 5,8 m²</b>
            <small>détail préparé par Koji · transmis aux entreprises de votre quartier</small>
            <div className="lc-pl">
              <div><Check /><span>Dépose et évacuation</span></div>
              <div><Check /><span>Receveur, paroi, robinetterie</span></div>
              <div><Check /><span>Faïence sur deux murs</span></div>
              <div className="no"><span>Hors : meuble vasque (non demandé)</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* « Est-ce sérieux ? » : quatre preuves */}
      <section className="lc-trust">
        {TRUST.map(([icon, title, text]) => (
          <div key={title}>
            <span className="lc-ti"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={icon} /></svg></span>
            <b>{title}</b>
            <p>{text}</p>
          </div>
        ))}
      </section>

      <section className="lc-steps" id="lc-steps">
        <div className="lc-sh">
          <h2>Comment ça marche</h2>
          <p>Trois étapes, et vous gardez la main à chacune.</p>
        </div>
        <div className="lc-sg">
          {STEPS.map(([title, text], idx) => (
            <div key={title}>
              <span className="lc-n">{idx + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
        <a href={DECRIRE} className="lc-b big lc-ph">Décrire mon projet</a>
      </section>

      <section className="lc-cmp">
        <div className="lc-sh">
          <h2>Comparez, sans vous tromper</h2>
          <p>Les propositions se lisent côte à côte, ligne par ligne. Les entreprises sont classées par date de réponse, jamais par paiement.</p>
        </div>
        <div className="lc-tbl">
          <div className="lc-tr h">
            <span />
            {COMPARE_HEAD.map((name) => <span key={name}>{name}</span>)}
          </div>
          {COMPARE.map((row) => (
            <div className="lc-tr" key={row.label}>
              <span>{row.label}</span>
              {row.values.map((value, idx) => (
                row.strong
                  ? <b key={idx} data-e={COMPARE_HEAD[idx]}>{value}</b>
                  : <span key={idx} data-e={COMPARE_HEAD[idx]}>{value}</span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="lc-dur" id="lc-dur">
        <div className="lc-dh">
          <h2>Pendant les travaux, vous n'êtes pas seul</h2>
          <p>Koji reste entre vous et l'entreprise jusqu'à la fin du chantier.</p>
        </div>
        <div className="lc-dl">
          {DURING.map(([title, text]) => (
            <div key={title}>
              <b>{title}</b>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lc-ver" id="lc-ver">
        <div className="lc-sh">
          <h2>Ce que « vérifiée » veut dire</h2>
          <p>Avant qu'une entreprise puisse répondre à votre projet, Koji contrôle :</p>
        </div>
        <div className="lc-vl">
          {VERIFIED.map(([title, detail, court]) => (
            <div key={title}>
              <Check />
              <b><span className="lc-dk">{title}</span><span className="lc-ph">{court}</span></b>
              <span className="lc-dk">{detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="lc-faq" id="lc-faq">
        <div className="lc-sh">
          <h2>Questions fréquentes</h2>
          <p>Une autre question ? <a href={CONTACT} className="lc-ul">Écrivez-nous</a>.</p>
        </div>
        <div className="lc-fq">
          {FAQ.map(([question, answer], idx) => (
            <details key={question} open={idx === 0 ? true : undefined}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lc-end">
        <div>
          <h2>Votre projet, décrit en cinq minutes.</h2>
          <p>Gratuit · sans engagement · votre numéro protégé</p>
        </div>
        <a href={DECRIRE} className="lc-b big sable">Décrire mon projet</a>
      </section>

      {/* Pied de page. « Travaux » et « À propos » : pages à créer. */}
      <footer className="lc-f">
        <div className="lc-fb">
          <span className="lc-w"><KojiWordmark height={14} /></span>
          <p>Des travaux bien décrits, un prix juste, des entreprises vérifiées.</p>
        </div>
        <div className="lc-fc">
          <b>Particuliers</b>
          <a href={DECRIRE}>Décrire mon projet</a>
          <a href={RETROUVER}>Retrouver mon projet</a>
          <a href="#lc-steps">Comment ça marche</a>
          <a href="#lc-ver">Entreprises vérifiées</a>
          <a href="#lc-faq">Questions</a>
        </div>
        <div className="lc-fc">
          <b>Travaux</b>
          <a>Salle de bain</a>
          <a>Cuisine</a>
          <a>Peinture</a>
          <a>Électricité</a>
          <a>Plomberie</a>
          <a>Tous les travaux</a>
        </div>
        <div className="lc-fc">
          <b>Entreprises</b>
          <a href={ENTREPRISE}>Koji pour les professionnels</a>
          <a href="/signup?type=entreprise">Créer une page entreprise</a>
          <a href="/entreprise/tarifs">Tarifs</a>
        </div>
        <div className="lc-fc">
          <b>Koji</b>
          <a>À propos</a>
          <a href={CONTACT}>Contact</a>
          <a href="/legal">Mentions légales</a>
          <a href="/legal">Conditions particuliers</a>
          <a href="/legal">Confidentialité</a>
          <a href="/legal">Cookies</a>
        </div>
        <div className="lc-fl">
          <span>© 2026 Koji</span>
          <span>Fait à Paris</span>
        </div>
      </footer>

      {/* Téléphone : l'action reste sous le pouce (bouton marine fixé en bas). */}
      <div className="lc-mbar">
        <a href={DECRIRE} className="lc-b big">Décrire mon projet</a>
      </div>
    </div>
  );
}
