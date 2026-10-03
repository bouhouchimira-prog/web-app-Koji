"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { apiGet, readStoredUser } from "../../../lib/client-api";
import { shortDate } from "../../../lib/pricing";

// Vue admin des conversations enregistrees (2 oct, demande d'Amira) — jamais
// affichee a une entreprise normale (verifie cote serveur dans
// app/api/admin/conversations/route.js, ceci n'est qu'un confort d'UI).
// Meme esprit que app/contacts/page.jsx : une page unique, pas de route
// [id], le detail de chaque client se deplie sur place.
export default function AdminClientsPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [openRadar, setOpenRadar] = useState({});
  const [openArtisan, setOpenArtisan] = useState({});
  const [openConv, setOpenConv] = useState({});

  useEffect(() => {
    const user = readStoredUser();
    if (!user?.isAdmin) {
      router.replace("/");
      return;
    }
    setAllowed(true);
    apiGet("/api/admin/conversations")
      .then(setData)
      .catch((err) => setError(err.message));
  }, [router]);

  if (allowed === null) return null;

  return (
    <Shell>
      <section className="mobile-tool">
        <header className="tool-topline">
          <button type="button" className="plain-back" onClick={() => router.push("/")}>{"<"}</button>
          <h1>Conversations enregistrées</h1>
          <span />
        </header>
        <p className="radar-recap-note" style={{ margin: "0 0 14px" }}>
          Historique des conversations avec l'assistant, pour debug en cas de problème — particuliers (Radar des Chantiers) et entreprises (assistant koji).
        </p>

        {error ? <div className="tool-empty">{error}</div> : null}
        {!data && !error ? <div className="tool-empty">Chargement…</div> : null}

        {data ? (
          <>
            <h2 style={{ fontSize: 16, margin: "18px 0 10px" }}>Clients particuliers — Radar des Chantiers ({data.radarClients.length})</h2>
            {data.radarClients.length === 0 ? <p className="radar-recap-note">Aucune conversation enregistrée pour l'instant.</p> : null}
            {data.radarClients.map((client) => (
              <div className="radar-recap-card" key={client.userId} style={{ marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => setOpenRadar((c) => ({ ...c, [client.userId]: !c[client.userId] }))}
                  style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", font: "inherit", color: "inherit" }}
                >
                  <strong>{client.name}</strong>{client.email ? ` — ${client.email}` : ""}
                  <small style={{ display: "block", color: "var(--muted)" }}>{client.conversations.length} conversation{client.conversations.length > 1 ? "s" : ""}</small>
                </button>
                {openRadar[client.userId] ? (
                  <div style={{ marginTop: 10 }}>
                    {client.conversations.map((conv) => {
                      const key = `${client.userId}:${conv.id}`;
                      return (
                        <div key={conv.id} style={{ borderTop: "1px solid var(--border, #eee)", paddingTop: 8, marginTop: 8 }}>
                          <button
                            type="button"
                            onClick={() => setOpenConv((c) => ({ ...c, [key]: !c[key] }))}
                            style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", font: "inherit", color: "inherit" }}
                          >
                            {conv.metier || "Métier non précisé"} — {shortDate(conv.updatedAt)} {conv.chantierOffreId ? "· Offre publiée" : "· Non publiée"}
                          </button>
                          {openConv[key] ? (
                            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                              {conv.turns.map((t, i) => (
                                <div key={i} style={{ fontSize: 13 }}>
                                  <strong>{t.role === "assistant" ? "koji" : "Client"} :</strong> {t.text}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}

            <h2 style={{ fontSize: 16, margin: "24px 0 10px" }}>Entreprises — assistant koji ({data.artisanConversations.length})</h2>
            {data.artisanConversations.length === 0 ? <p className="radar-recap-note">Aucune conversation enregistrée pour l'instant.</p> : null}
            {data.artisanConversations.map((client) => (
              <div className="radar-recap-card" key={client.userId} style={{ marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => setOpenArtisan((c) => ({ ...c, [client.userId]: !c[client.userId] }))}
                  style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", font: "inherit", color: "inherit" }}
                >
                  <strong>{client.name}</strong>{client.email ? ` — ${client.email}` : ""}
                  <small style={{ display: "block", color: "var(--muted)" }}>{client.conversations.length} conversation{client.conversations.length > 1 ? "s" : ""}</small>
                </button>
                {openArtisan[client.userId] ? (
                  <div style={{ marginTop: 10 }}>
                    {client.conversations.map((conv) => {
                      const key = `a:${client.userId}:${conv.id}`;
                      return (
                        <div key={conv.id} style={{ borderTop: "1px solid var(--border, #eee)", paddingTop: 8, marginTop: 8 }}>
                          <button
                            type="button"
                            onClick={() => setOpenConv((c) => ({ ...c, [key]: !c[key] }))}
                            style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", font: "inherit", color: "inherit" }}
                          >
                            {shortDate(conv.updatedAt)} — {conv.messages.length} message{conv.messages.length > 1 ? "s" : ""}
                          </button>
                          {openConv[key] ? (
                            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                              {conv.messages.map((m, i) => (
                                <div key={i} style={{ fontSize: 13 }}>
                                  <strong>{m.role === "assistant" ? "koji" : "Entreprise"} :</strong> {m.message}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </>
        ) : null}
      </section>
    </Shell>
  );
}
