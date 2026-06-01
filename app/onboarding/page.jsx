"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { PhoneFrame } from "../../components/PhoneFrame";

const pages = [
  {
    title: "Pilotez vos chantiers simplement",
    description: "Du premier rendez-vous client jusqu'a la fin des travaux",
    image: "/images/onboarding_1.png"
  },
  {
    title: "Suivez le chantier au quotidien",
    description: "Photos, notes et avancement centralises au meme endroit",
    image: "/images/onboarding_2.png"
  },
  {
    title: "Des devis clairs, des clients satisfaits",
    description: "Vos informations terrain deviennent des devis professionnels",
    image: "/images/onboarding_3.png"
  }
];

export default function OnboardingPage() {
  const [index, setIndex] = useState(0);
  const page = pages[index];
  const last = index === pages.length - 1;

  return (
    <PhoneFrame>
      <section className="screen welcome-screen">
        <div style={{ textAlign: "right" }}>
          <Link href="/welcome" className="muted" style={{ fontWeight: 800 }}>
            Passer
          </Link>
        </div>
        <div style={{ display: "grid", placeItems: "center", minHeight: 330 }}>
          <Image src={page.image} alt="" width={310} height={310} style={{ objectFit: "contain", maxWidth: "100%" }} priority />
        </div>
        <div className="welcome-copy" style={{ paddingTop: 0 }}>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
        <div className="step-dots">
          {pages.map((_, dotIndex) => (
            <span key={dotIndex} className={dotIndex === index ? "active" : ""} />
          ))}
        </div>
        <div className="bottom-action">
          {last ? (
            <Link href="/welcome" className="full-button" style={{ display: "grid", placeItems: "center" }}>
              Commencer
            </Link>
          ) : (
            <button className="full-button" onClick={() => setIndex(index + 1)}>
              Suivant
            </button>
          )}
        </div>
      </section>
    </PhoneFrame>
  );
}
