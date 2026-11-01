"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "../../components/Shell";
import { apiGet, apiSend } from "../../lib/client-api";
import { useApi } from "../../lib/use-api";
import { euro } from "../../lib/pricing";
import { fixText } from "../../lib/text";

const KBIS_MAX_AGE_DAYS = 90;

function day(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function short(value) {
  const date = day(value);
  return date ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date) : "";
}

function dateRange(start, end) {
  if (!start) return "dates à convenir";
  return end && end !== start ? `${short(start)} → ${short(end)}` : short(start);
}

function plural(count, word) {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

function docLine(kind, profil) {
  const today = day(new Date().toISOString());
  if (kind === "kbis") {
    const date = day(profil?.kbisDate);
    if (!date) return "à renseigner";
    return (today - date) / 86400000 > KBIS_MAX_AGE_DAYS ? `trop ancien · ${short(profil.kbisDate)}` : `à jour · ${short(profil.kbisDate)}`;
  }
  const value = kind === "urssaf" ? profil?.urssafUntil : profil?.decennaleUntil;
  const date = day(value);
  if (!date) return "à renseigner";
  return date < today ? `expirée le ${short(value)}` : `valable jusqu'au ${short(value)}`;
}

const EMPTY_BESOIN = { title: "", metier: "", budgetHt: "", city: "", fournitures: "moi", startDate: "", endDate: "", hideClient: true, message: "", projectId: "", projectTitle: "", lotLabel: "" };

export default function ReseauProPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("besoins");
  const [metierFilter, setMetierFilter] = useState("");
  const [nearOnly, setNearOnly] = useState(false);
  const [docsOnly, setDocsOnly] = useState(false);
  const [besoinFilter, setBesoinFilter] = useState("");
  const [publish, setPublish] = useState(null);
  const [profilForm, setProfilForm] = useState(null);
  const [contact, setContact] = useState(null);
  const [openEchangeId, setOpenEchangeId] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const { data: tasks } = useApi("/api/tasks", "tasks");
  const { data: projects } = useApi("/api/projects", "projects");

  async function reload() {
    try {
      setData(await apiGet("/api/reseau"));
      setError("");
    } catch (err) {
      setError(err.message || "Chargement impossible.");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (["besoins", "pros", "echanges"].includes(params.get("tab"))) setTab(params.get("tab"));
    if (params.get("e")) setOpenEchangeId(params.get("e"));
    reload();
  }, []);

  const me = data?.me;
  const besoins = data?.besoins || [];
  const pros = data?.pros || [];
  const echanges = data?.echanges || [];

  const metierChips = useMemo(() => {
    const counts = new Map();
    [...besoins.map((besoin) => besoin.metier), ...pros.flatMap((pro) => pro.metiers)].forEach((metier) => {
      const key = fixText(metier || "").trim();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([metier]) => metier);
  }, [besoins, pros]);

  const radius = me?.radiusKm || 20;
  const matchesMetier = (value) => !metierFilter || String(value || "").toLowerCase().includes(metierFilter.toLowerCase());
  const isNear = (km) => km !== null && km !== undefined && km <= radius;

  const visibleBesoins = besoins.filter((besoin) => matchesMetier(besoin.metier) && (!nearOnly || besoin.mine || isNear(besoin.distanceKm)));
  const visiblePros = pros.filter((pro) => (!metierFilter || pro.metiers.some(matchesMetier)) && (!nearOnly || isNear(pro.distanceKm)) && (!docsOnly || pro.documentsOk));
  const visibleEchanges = besoinFilter ? echanges.filter((echange) => echange.besoinId === besoinFilter) : echanges;
  const openEchange = echanges.find((echange) => echange.id === openEchangeId) || null;

  // « Mes lots sans intervenant » : tâches de mes chantiers sans personne
  // affectée, regroupées par lot (même découpage que le planning).
  const freeLots = useMemo(() => {
    const groups = new Map();
    tasks.filter((task) => !task.done && task.projectId && !(Array.isArray(task.workerIds) && task.workerIds.length)).forEach((task) => {
      const lot = fixText(task.room || task.label || "Lot");
      const key = `${task.projectId}|${lot}`;
      const start = task.startDate || task.dueDate || "";
      const end = task.endDate || task.dueDate || task.startDate || "";
      const current = groups.get(key);
      if (!current) {
        const project = projects.find((item) => item.id === task.projectId);
        groups.set(key, { key, projectId: task.projectId, projectTitle: fixText(project?.title || task.project || "Chantier"), lot, start, end });
      } else {
        if (start && (!current.start || start < current.start)) current.start = start;
        if (end && end > current.end) current.end = end;
      }
    });
    const published = new Set(besoins.filter((besoin) => besoin.mine && besoin.status === "ouvert").map((besoin) => `${besoin.projectTitle}|${besoin.lotLabel}`));
    return [...groups.values()].map((group) => ({ ...group, published: published.has(`${group.projectTitle}|${group.lot}`) })).slice(0, 6);
  }, [tasks, projects, besoins]);

  function openPublish(lot = null) {
    setPublish({
      ...EMPTY_BESOIN,
      city: me?.city || "",
      metier: me?.professions?.[0] || "",
      ...(lot ? { title: lot.lot, lotLabel: lot.lot, projectId: lot.projectId, projectTitle: lot.projectTitle, startDate: lot.start, endDate: lot.end } : {})
    });
  }

  function openProfil() {
    const profil = me?.profil;
    setProfilForm({
      visible: profil ? Boolean(profil.visible) : true,
      metiers: (profil?.metiers?.length ? profil.metiers : me?.professions || []).join(", "),
      zone: profil?.zone || me?.city || "",
      availableFrom: profil?.availableFrom || "",
      availabilityNote: profil?.availabilityNote || "",
      kbisDate: profil?.kbisDate || "",
      urssafUntil: profil?.urssafUntil || "",
      decennaleUntil: profil?.decennaleUntil || ""
    });
  }

  async function run(payload, done) {
    setBusy(true);
    setNotice("");
    try {
      const result = await apiSend("/api/reseau", payload);
      await reload();
      done?.(result);
    } catch (err) {
      setNotice(err.message || "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  function submitPublish(event) {
    event.preventDefault();
    run({ action: "besoin", ...publish }, () => {
      setPublish(null);
      setTab("besoins");
      setNotice("Besoin publié dans le Réseau pro.");
    });
  }

  function submitProfil(event) {
    event.preventDefault();
    run({ action: "profil", ...profilForm, metiers: profilForm.metiers.split(",").map((value) => value.trim()).filter(Boolean) }, () => {
      setProfilForm(null);
      setNotice("Profil réseau enregistré.");
    });
  }

  function submitContact(event) {
    event.preventDefault();
    const payload = contact.besoin ? { besoinId: contact.besoin.id } : { profilId: contact.pro.id };
    run({ action: "contacter", text: draft, ...payload }, (result) => {
      setContact(null);
      setDraft("");
      setTab("echanges");
      setOpenEchangeId(result.echange.id);
    });
  }

  function submitMessage(event) {
    event.preventDefault();
    run({ action: "message", echangeId: openEchange.id, text: draft }, () => setDraft(""));
  }

  function besoinMeta(besoin) {
    return [`${besoin.days || 1} j`, dateRange(besoin.startDate, besoin.endDate), besoin.city, besoin.distanceKm !== null ? `${String(besoin.distanceKm).replace(".", ",")} km` : ""].filter(Boolean).join(" · ");
  }

  function besoinBy(besoin) {
    return [
      besoin.mine ? "Votre besoin" : besoin.companyName,
      besoin.lotLabel ? `${besoin.lotLabel} d'un chantier Koji` : "",
      besoin.mine && besoin.status !== "ouvert" ? (besoin.status === "pourvu" ? "pourvu" : "clos") : "",
      plural(besoin.responses, "réponse")
    ].filter(Boolean).join(" · ");
  }

  if (data?.locked) {
    return (
      <Shell variant="pro">
        <div className="head"><div className="stack"><span className="eyebrow">Entre professionnels · sans jetons</span><h1>Réseau pro</h1></div></div>
        <section className="card">
          <div className="card-h"><h2>Inclus dans les offres Pro et Business</h2></div>
          <p className="muted">Publiez vos besoins de sous-traitance et trouvez des pros disponibles près de vos chantiers, sans jetons ni quota.</p>
          <div><Link className="btn btn-main" href="/parametres/abonnement">Voir les offres</Link></div>
        </section>
      </Shell>
    );
  }

  return (
    <Shell variant="pro">
      <div className="head">
        <div className="stack">
          <span className="eyebrow">Entre professionnels · documents à jour · sans jetons</span>
          <h1>Réseau pro</h1>
        </div>
        <div className="hact">
          <button type="button" className="btn btn-sec" onClick={openProfil} disabled={!data}>Ma disponibilité</button>
          <button type="button" className="btn btn-main" onClick={() => openPublish()} disabled={!data}>Publier un besoin</button>
        </div>
      </div>

      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {error ? <p className="notice" role="alert">{error}</p> : null}

      <div className="tbar">
        <div className="wtabs" role="tablist" aria-label="Réseau pro">
          {[["besoins", "Besoins", visibleBesoins.length], ["pros", "Pros disponibles", visiblePros.length], ["echanges", "Mes échanges", echanges.length]].map(([id, label, count]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => { setTab(id); setBesoinFilter(""); }}>
              {label} <span>{count}</span>
            </button>
          ))}
        </div>
        {tab !== "echanges" ? (
          <div className="rp-f" role="group" aria-label="Filtres">
            <button type="button" className={`rp-chip${!metierFilter ? " on" : ""}`} aria-pressed={!metierFilter} onClick={() => setMetierFilter("")}>Tous métiers</button>
            {metierChips.map((metier) => (
              <button key={metier} type="button" className={`rp-chip${metierFilter === metier ? " on" : ""}`} aria-pressed={metierFilter === metier} onClick={() => setMetierFilter(metierFilter === metier ? "" : metier)}>{metier}</button>
            ))}
            {me?.hasZone ? (
              <button type="button" className={`rp-chip${nearOnly ? " on" : ""}`} aria-pressed={nearOnly} onClick={() => setNearOnly(!nearOnly)}>{radius} km</button>
            ) : null}
            {tab === "pros" ? (
              <button type="button" className={`rp-chip${docsOnly ? " on" : ""}`} aria-pressed={docsOnly} onClick={() => setDocsOnly(!docsOnly)}>Documents à jour</button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rp-grid">
        <div className="rp-main">
          {!data && !error ? <p className="empty">Chargement…</p> : null}

          {data && tab === "besoins" ? (
            <section className="card rp-list">
              <div className="card-h"><h2>{me?.hasZone ? "Besoins près de toi" : "Besoins du réseau"}</h2><span className="muted">les plus récents d'abord</span></div>
              {visibleBesoins.length === 0 ? (
                <p className="empty">Aucun besoin pour ces filtres. Publiez le vôtre : il apparaîtra ici pour les pros du réseau.</p>
              ) : visibleBesoins.map((besoin) => (
                <div className="nd" key={besoin.id}>
                  <div className="nd-m">
                    <span className="avp" aria-hidden="true">{besoin.initials}</span>
                    <div className="nd-t">
                      <strong>{besoin.metier} · {besoin.title}</strong>
                      <span className="muted">{besoinMeta(besoin)}</span>
                      <span className="nd-by">{besoinBy(besoin)}</span>
                      {besoin.message ? <span className="nd-msg">{besoin.message}</span> : null}
                    </div>
                  </div>
                  <div className="nd-r">
                    <b>{besoin.budgetHt ? `${euro(besoin.budgetHt)} HT` : "budget à proposer"}</b>
                    {besoin.mine ? (
                      <>
                        <button type="button" className="btn btn-sec" onClick={() => { setTab("echanges"); setBesoinFilter(besoin.id); }} disabled={!besoin.responses}>
                          {besoin.responses ? "Voir les réponses" : "Pas encore de réponse"}
                        </button>
                        {besoin.status === "ouvert" ? (
                          <button type="button" className="link" disabled={busy} onClick={() => run({ action: "besoin-statut", id: besoin.id, status: "ferme" })}>Clore le besoin</button>
                        ) : null}
                      </>
                    ) : besoin.myEchangeId ? (
                      <button type="button" className="btn btn-sec" onClick={() => { setTab("echanges"); setOpenEchangeId(besoin.myEchangeId); }}>Voir l'échange</button>
                    ) : (
                      <button type="button" className="btn btn-sec" onClick={() => { setDraft(""); setContact({ besoin }); }}>Répondre</button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          {data && tab === "pros" ? (
            <section className="card rp-list">
              <div className="card-h"><h2>Pros disponibles</h2><span className="muted">{me?.hasZone ? "les plus proches d'abord" : "renseignez votre zone dans le Profil pour voir les distances"}</span></div>
              {visiblePros.length === 0 ? (
                <p className="empty">Aucun pro visible pour ces filtres. Les entreprises apparaissent ici quand elles activent leur profil réseau.</p>
              ) : visiblePros.map((pro) => (
                <div className="nd" key={pro.id}>
                  <div className="nd-m">
                    <span className="avp" aria-hidden="true">{pro.initials}</span>
                    <div className="nd-t">
                      <strong>{pro.companyName} <span className={`ver${pro.documentsOk ? "" : " off"}`}>{pro.documentsOk ? "Documents à jour" : "Documents à jour requis"}</span></strong>
                      <span className="muted">{[pro.metiers.join(", "), pro.zone, pro.distanceKm !== null ? `${String(pro.distanceKm).replace(".", ",")} km` : ""].filter(Boolean).join(" · ")}</span>
                      <span className="nd-by">{[pro.availableFrom ? `Disponible dès le ${short(pro.availableFrom)}` : "", pro.availabilityNote].filter(Boolean).join(" · ") || "Disponibilité non précisée"}</span>
                    </div>
                  </div>
                  <div className="nd-r">
                    <button type="button" className="btn btn-sec" onClick={() => { setDraft(""); setContact({ pro }); }}>Contacter</button>
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          {data && tab === "echanges" ? (
            <section className="card rp-list">
              <div className="card-h">
                <h2>{besoinFilter ? "Réponses à votre besoin" : "Mes échanges"}</h2>
                {besoinFilter ? <button type="button" className="link" onClick={() => setBesoinFilter("")}>Tous les échanges</button> : null}
              </div>
              {visibleEchanges.length === 0 ? (
                <p className="empty">Aucun échange pour le moment. Répondez à un besoin ou contactez un pro pour en démarrer un.</p>
              ) : visibleEchanges.map((echange) => {
                const last = echange.messages[echange.messages.length - 1];
                return (
                  <button type="button" className="nd nd-btn" key={echange.id} onClick={() => { setDraft(""); setOpenEchangeId(echange.id); }}>
                    <div className="nd-m">
                      <span className="avp" aria-hidden="true">{echange.other.initials}</span>
                      <div className="nd-t">
                        <strong>{echange.other.companyName}</strong>
                        <span className="muted">{echange.besoinTitle || "Contact direct"}</span>
                        {last ? <span className="nd-by">{last.mine ? "Vous : " : ""}{last.text.slice(0, 120)}</span> : null}
                      </div>
                    </div>
                    <div className="nd-r">
                      {echange.status === "retenu" ? <span className="tag tag-e">Retenu</span> : null}
                      <small className="muted">{short(echange.updatedAt)}</small>
                    </div>
                  </button>
                );
              })}
            </section>
          ) : null}
        </div>

        <aside className="rp-side">
          <section className="card">
            <div className="card-h"><h2>Mon profil réseau</h2><button type="button" className="link" onClick={openProfil} disabled={!data}>Modifier</button></div>
            {me?.profil ? (
              <>
                <div className="kv"><span>Statut</span><b><span className={`ver${me.documents.ok ? "" : " off"}`}>{me.documents.ok ? "Documents à jour" : "Documents à jour requis"}</span></b></div>
                <div className="kv"><span>Kbis</span><b>{docLine("kbis", me.profil)}</b></div>
                <div className="kv"><span>URSSAF</span><b>{docLine("urssaf", me.profil)}</b></div>
                <div className="kv"><span>Décennale</span><b>{docLine("decennale", me.profil)}</b></div>
                <div className="kv"><span>Métiers</span><b>{me.profil.metiers?.join(", ") || "à renseigner"}</b></div>
                <div className="kv"><span>Disponibilité</span><b>{[me.profil.availableFrom ? `dès le ${short(me.profil.availableFrom)}` : "", me.profil.availabilityNote].filter(Boolean).join(" · ") || "à renseigner"}</b></div>
                <div className="kv"><span>Annuaire</span><b>{me.profil.visible ? (me.documents.expired ? "masqué : document expiré" : "visible") : "masqué"}</b></div>
              </>
            ) : (
              <p className="muted">Activez votre profil pour apparaître dans les pros disponibles et recevoir des demandes.</p>
            )}
            <p className="sv-note">Un document expiré masque le profil du réseau jusqu'à régularisation.</p>
          </section>

          <section className="card">
            <div className="card-h"><h2>Mes lots sans intervenant</h2></div>
            {freeLots.length === 0 ? (
              <p className="empty">Tous vos lots planifiés ont un intervenant.</p>
            ) : freeLots.map((lot) => (
              <div className="kv" key={lot.key}><span>{lot.projectTitle}</span><b>{lot.lot}{lot.published ? " · besoin publié" : ""}</b></div>
            ))}
            {freeLots.some((lot) => !lot.published) ? (
              <button type="button" className="btn btn-sec rp-wide" onClick={() => openPublish(freeLots.find((lot) => !lot.published))}>Sous-traiter un lot</button>
            ) : null}
          </section>

          <section className="card">
            <div className="card-h"><h2>Règles du réseau</h2></div>
            <ul className="rp-rules">
              <li>Pro et Business, sans jetons ni quota.</li>
              <li>Documents demandés : Kbis de moins de 3 mois, attestation URSSAF, décennale. Les dates sont déclarées par chaque entreprise ; Koji ne vérifie pas encore les pièces.</li>
              <li>Échanges dans Koji, notifiés à l'autre entreprise.</li>
              <li>Contrat de sous-traitance : hors Koji pour l'instant.</li>
            </ul>
          </section>
        </aside>
      </div>

      {publish ? (
        <div className="pmodal-bg" onClick={() => setPublish(null)}>
          <form className="pmodal" role="dialog" aria-modal="true" aria-label="Publier un besoin" onClick={(event) => event.stopPropagation()} onSubmit={submitPublish}>
            <div className="card-h"><h2>Publier un besoin</h2><button type="button" className="link" onClick={() => setPublish(null)}>Fermer</button></div>
            {publish.lotLabel ? (
              <div className="env-sum">
                <div><span className="lab">Depuis le chantier</span><strong>{publish.projectTitle}</strong><span className="muted">{publish.lotLabel}</span></div>
                <div><span className="lab">Dates du lot</span><strong>{dateRange(publish.startDate, publish.endDate)}</strong><span className="muted">planning du chantier</span></div>
              </div>
            ) : null}
            <label className="ed">Besoin
              <input value={publish.title} onChange={(event) => setPublish({ ...publish, title: event.target.value })} placeholder="Ex : création alimentation et évacuation, pose receveur" required maxLength={200} />
            </label>
            <div className="fgrid">
              <label>Métier
                <input value={publish.metier} onChange={(event) => setPublish({ ...publish, metier: event.target.value })} list="rp-metiers" required maxLength={60} />
              </label>
              <label>Budget main-d'œuvre HT (indicatif)
                <input type="number" min="0" step="any" value={publish.budgetHt} onChange={(event) => setPublish({ ...publish, budgetHt: event.target.value })} placeholder="Laisser vide pour recevoir des propositions" />
              </label>
              <label>Début
                <input type="date" value={publish.startDate} onChange={(event) => setPublish({ ...publish, startDate: event.target.value })} />
              </label>
              <label>Fin
                <input type="date" value={publish.endDate} min={publish.startDate || undefined} onChange={(event) => setPublish({ ...publish, endDate: event.target.value })} />
              </label>
              <label>Zone
                <input value={publish.city} onChange={(event) => setPublish({ ...publish, city: event.target.value })} placeholder="Ville ou arrondissement" maxLength={120} />
              </label>
              <label>Fournitures
                <select value={publish.fournitures} onChange={(event) => setPublish({ ...publish, fournitures: event.target.value })}>
                  <option value="moi">Fournies par moi</option>
                  <option value="sous-traitant">Par le sous-traitant</option>
                </select>
              </label>
            </div>
            <datalist id="rp-metiers">
              {[...new Set([...(me?.professions || []), "Plomberie", "Électricité", "Peinture", "Carrelage", "Maçonnerie", "Menuiserie", "Plâtrerie", "Main-d'œuvre"])].map((metier) => <option key={metier} value={metier} />)}
            </datalist>
            {publish.projectTitle ? (
              <label className="chk"><input type="checkbox" checked={publish.hideClient} onChange={(event) => setPublish({ ...publish, hideClient: event.target.checked })} />Masquer le nom du chantier aux autres pros</label>
            ) : null}
            <label className="ed">Message
              <textarea rows={3} value={publish.message} onChange={(event) => setPublish({ ...publish, message: event.target.value })} placeholder="Accès, contraintes, date de démarrage…" maxLength={2000} />
            </label>
            {notice ? <p className="notice" role="alert">{notice}</p> : null}
            <div className="pm-act">
              <button type="button" className="btn btn-sec" onClick={() => setPublish(null)}>Annuler</button>
              <button type="submit" className="btn btn-main" disabled={busy}>{busy ? "Publication…" : "Publier"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {profilForm ? (
        <div className="pmodal-bg" onClick={() => setProfilForm(null)}>
          <form className="pmodal" role="dialog" aria-modal="true" aria-label="Mon profil réseau" onClick={(event) => event.stopPropagation()} onSubmit={submitProfil}>
            <div className="card-h"><h2>Mon profil réseau</h2><button type="button" className="link" onClick={() => setProfilForm(null)}>Fermer</button></div>
            <label className="chk"><input type="checkbox" checked={profilForm.visible} onChange={(event) => setProfilForm({ ...profilForm, visible: event.target.checked })} />Apparaître dans les pros disponibles</label>
            <div className="fgrid">
              <label className="full">Métiers (séparés par des virgules)
                <input value={profilForm.metiers} onChange={(event) => setProfilForm({ ...profilForm, metiers: event.target.value })} placeholder="Plomberie, chauffage" />
              </label>
              <label>Zone affichée
                <input value={profilForm.zone} onChange={(event) => setProfilForm({ ...profilForm, zone: event.target.value })} placeholder="Paris, petite couronne" maxLength={120} />
              </label>
              <label>Disponible dès le
                <input type="date" value={profilForm.availableFrom} onChange={(event) => setProfilForm({ ...profilForm, availableFrom: event.target.value })} />
              </label>
              <label className="full">Précision sur la disponibilité
                <input value={profilForm.availabilityNote} onChange={(event) => setProfilForm({ ...profilForm, availabilityNote: event.target.value })} placeholder="Équipe libre du 1er au 11 déc." maxLength={200} />
              </label>
              <label>Date de l'extrait Kbis
                <input type="date" value={profilForm.kbisDate} onChange={(event) => setProfilForm({ ...profilForm, kbisDate: event.target.value })} />
              </label>
              <label>URSSAF valable jusqu'au
                <input type="date" value={profilForm.urssafUntil} onChange={(event) => setProfilForm({ ...profilForm, urssafUntil: event.target.value })} />
              </label>
              <label>Décennale valable jusqu'au
                <input type="date" value={profilForm.decennaleUntil} onChange={(event) => setProfilForm({ ...profilForm, decennaleUntil: event.target.value })} />
              </label>
            </div>
            <p className="muted">Les distances partent de la zone d'intervention de votre Profil. Les dates des documents sont déclarées par vous.</p>
            {notice ? <p className="notice" role="alert">{notice}</p> : null}
            <div className="pm-act">
              <button type="button" className="btn btn-sec" onClick={() => setProfilForm(null)}>Annuler</button>
              <button type="submit" className="btn btn-main" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {contact ? (
        <div className="pmodal-bg" onClick={() => setContact(null)}>
          <form className="pmodal" role="dialog" aria-modal="true" aria-label={contact.besoin ? "Répondre au besoin" : "Contacter"} onClick={(event) => event.stopPropagation()} onSubmit={submitContact}>
            <div className="card-h">
              <h2>{contact.besoin ? "Répondre au besoin" : `Contacter ${contact.pro.companyName}`}</h2>
              <button type="button" className="link" onClick={() => setContact(null)}>Fermer</button>
            </div>
            {contact.besoin ? (
              <div className="env-sum">
                <div><span className="lab">{contact.besoin.companyName}</span><strong>{contact.besoin.metier} · {contact.besoin.title}</strong><span className="muted">{besoinMeta(contact.besoin)}</span></div>
                <div><span className="lab">Budget</span><strong>{contact.besoin.budgetHt ? `${euro(contact.besoin.budgetHt)} HT` : "à proposer"}</strong><span className="muted">{contact.besoin.fournitures === "moi" ? "fournitures fournies" : "fournitures par vous"}</span></div>
              </div>
            ) : null}
            <label className="ed">Message
              <textarea rows={4} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={contact.besoin ? "Disponibilités, prix proposé, questions…" : "Présentez votre demande"} required maxLength={2000} autoFocus />
            </label>
            {notice ? <p className="notice" role="alert">{notice}</p> : null}
            <div className="pm-act">
              <button type="button" className="btn btn-sec" onClick={() => setContact(null)}>Annuler</button>
              <button type="submit" className="btn btn-main" disabled={busy || !draft.trim()}>{busy ? "Envoi…" : "Envoyer"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {openEchange ? (
        <div className="pmodal-bg" onClick={() => setOpenEchangeId("")}>
          <form className="pmodal" role="dialog" aria-modal="true" aria-label={`Échange avec ${openEchange.other.companyName}`} onClick={(event) => event.stopPropagation()} onSubmit={submitMessage}>
            <div className="card-h">
              <h2>{openEchange.other.companyName}</h2>
              <button type="button" className="link" onClick={() => setOpenEchangeId("")}>Fermer</button>
            </div>
            <p className="muted">{openEchange.besoinTitle ? `À propos de : ${openEchange.besoinTitle}` : "Contact direct"}{openEchange.status === "retenu" ? " · retenu" : ""}</p>
            <div className="msgs rp-msgs">
              {openEchange.messages.map((message) => (
                <div key={message.id} className={`msg ${message.mine ? "u" : "k"}`}>{message.text}</div>
              ))}
            </div>
            <label className="ed">Votre message
              <textarea rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} />
            </label>
            {notice ? <p className="notice" role="alert">{notice}</p> : null}
            <div className="pm-act">
              {openEchange.iOwnBesoin && openEchange.status !== "retenu" ? (
                <button type="button" className="btn btn-sec" disabled={busy} onClick={() => run({ action: "retenir", echangeId: openEchange.id }, () => setNotice(`${openEchange.other.companyName} est retenu ; le besoin passe en « pourvu ».`))}>Retenir ce pro</button>
              ) : null}
              <button type="submit" className="btn btn-main" disabled={busy || !draft.trim()}>{busy ? "Envoi…" : "Envoyer"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </Shell>
  );
}
