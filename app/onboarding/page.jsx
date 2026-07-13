"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { PhoneFrame } from "../../components/PhoneFrame";
import { useLocale } from "../../lib/i18n";

export default function OnboardingPage() {
  const { L } = useLocale();
  const [index, setIndex] = useState(0);

  const pages = [
    { title: L.onboarding.slide1title, description: L.onboarding.slide1desc, image: "/images/onboarding_1.png" },
    { title: L.onboarding.slide2title, description: L.onboarding.slide2desc, image: "/images/onboarding_2.png" },
    { title: L.onboarding.slide3title, description: L.onboarding.slide3desc, image: "/images/onboarding_3.png" },
  ];

  const page = pages[index];
  const last = index === pages.length - 1;

  return (
    <PhoneFrame>
      <section className="screen welcome-screen">
        <div style={{ textAlign: "right" }}>
          <Link href="/welcome" className="muted" style={{ fontWeight: 400 }}>
            {L.onboarding.skip}
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
              {L.onboarding.start}
            </Link>
          ) : (
            <button className="full-button" onClick={() => setIndex(index + 1)}>
              {L.onboarding.next}
            </button>
          )}
        </div>
      </section>
    </PhoneFrame>
  );
}
