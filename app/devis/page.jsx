"use client";

import { useEffect, useState } from "react";
import { getChantierDraft } from "../../lib/chantier-draft";
import DevisEditor from "./DevisEditor";
import DevisHistory from "./DevisHistory";

export default function DevisPage() {
  const [mode, setMode] = useState("list");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const needsEditor = Boolean(
      params.get("id") ||
      params.get("selection") ||
      params.get("new") ||
      getChantierDraft()
    );
    setMode(needsEditor ? "editor" : "list");
  }, []);

  return mode === "editor" ? <DevisEditor /> : <DevisHistory />;
}
