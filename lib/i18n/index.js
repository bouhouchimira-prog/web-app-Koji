"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { locales, SUPPORTED, RTL_LANGS } from "./locales";

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState("fr");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("koji-lang");
      if (saved && SUPPORTED.includes(saved)) { setLangState(saved); return; }
      const nav = (navigator.language || "").slice(0, 2).toLowerCase();
      setLangState(SUPPORTED.includes(nav) ? nav : "fr");
    } catch {
      setLangState("fr");
    }
  }, []);

  useEffect(() => {
    const dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir  = dir;
    try { localStorage.setItem("koji-lang", lang); } catch { /**/ }
  }, [lang]);

  function setLang(value) {
    if (SUPPORTED.includes(value)) setLangState(value);
  }

  const L   = locales[lang] || locales.fr;
  const dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";

  return (
    <I18nContext.Provider value={{ lang, setLang, dir, L }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLocale() {
  return useContext(I18nContext);
}
