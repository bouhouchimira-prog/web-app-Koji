"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "../lib/i18n";

const LANGS = [
  { code: "fr" },
  { code: "en" },
  { code: "ar" },
  { code: "de" },
  { code: "it" },
];

const LABELS = { fr: "FR", en: "EN", ar: "AR", de: "DE", it: "IT" };

export function LangSwitcher() {
  const { lang, setLang, L } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="topbar-lang" ref={ref}>
      <button
        type="button"
        className="topbar-lang-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{LABELS[lang] || lang.toUpperCase()}</span>
        <svg viewBox="0 0 10 6" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 3, opacity: 0.7 }}><path d="M1 1l4 4 4-4" /></svg>
      </button>
      {open && (
        <ul className="topbar-lang-dropdown" role="listbox">
          {LANGS.map(({ code }) => (
            <li key={code} role="option" aria-selected={lang === code}>
              <button
                type="button"
                className={lang === code ? "active" : ""}
                onClick={() => { setLang(code); setOpen(false); }}
              >
                <span>{LABELS[code]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
