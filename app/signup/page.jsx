"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { EntrepriseAuthLayout } from "../../components/EntrepriseAuthLayout";
import { EntrepriseSignup } from "../../components/EntrepriseSignup";
import { LangSwitcher } from "../../components/LangSwitcher";
import { useLocale } from "../../lib/i18n";

// Inscription Koji Pro (maquette PRO-00, « créer un compte ») : formulaire
// minimal (components/EntrepriseSignup.jsx), puis « Vérifiez votre boîte
// mail » quand une activation par e-mail est demandée, ou « Compte créé ».
// L'inscription « Koji » (particulier) se fait dans le panneau Koji de
// /login, pas ici.
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v14H4zM4 6l8 7 8-7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}

function SignupScreen() {
  const { L } = useLocale();
  const [result, setResult] = useState(null);

  if (result && !result.activationRequired) {
    return (
      <EntrepriseAuthLayout>
        <div className="el el-done">
          <span className="el-ico"><CheckIcon /></span>
          <h1 className="el-h">Compte créé</h1>
          <p className="el-p">Votre compte est prêt. Connectez-vous pour commencer le démarrage guidé.</p>
          <Link className="el-btn-primary" href="/login?type=entreprise">Se connecter</Link>
        </div>
      </EntrepriseAuthLayout>
    );
  }

  if (result) {
    return (
      <EntrepriseAuthLayout>
        <div className="el el-done">
          <span className="el-ico"><MailIcon /></span>
          <h1 className="el-h">{L.auth.checkEmail}</h1>
          <p className="el-p">{L.auth.confirmSub(result.email)}</p>
          {result.directActivationUrl ? (
            <>
              <p className="el-note">{L.auth.emailNotSent}</p>
              <a href={result.directActivationUrl} className="el-btn-primary">{L.auth.activateBtn}</a>
            </>
          ) : null}
          <p className="el-note">
            {L.auth.noEmailReceived} Vérifiez vos indésirables, ou{" "}
            <button type="button" className="el-text-btn" onClick={() => setResult(null)}>recommencez avec une autre adresse</button>.
          </p>
          <Link className="el-btn-sec" href="/login?type=entreprise">{L.auth.goToLogin}</Link>
        </div>
      </EntrepriseAuthLayout>
    );
  }

  return (
    <EntrepriseAuthLayout aside={<LangSwitcher />}>
      <EntrepriseSignup L={L} onDone={setResult} />
    </EntrepriseAuthLayout>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupScreen />
    </Suspense>
  );
}
