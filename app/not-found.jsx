import Link from "next/link";
import "./home-pro.css";

// Page introuvable (gabarit DA Koji Pro, maquette PRO-19, états techniques).
export default function NotFound() {
  return (
    <div className="pro public-pro wide">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">Erreur 404</span>
          <h1>Cette page n'existe plus</h1>
          <span className="muted">Le lien est peut-être ancien. Revenez à l'accueil ou cherchez dans Koji.</span>
        </div>
        <div className="hact">
          <Link href="/" className="btn btn-main">Retour à l'accueil</Link>
        </div>
      </div>
    </div>
  );
}
