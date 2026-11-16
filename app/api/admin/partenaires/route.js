import { badRequest, ok } from "../../../../lib/http";
import { makeToken, readDb, writeDb } from "../../../../lib/db";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { isVerifiedUserAdmin } from "../../../../lib/admin-account";
import { contenanceDe, controlerMercuriale, lireMercurialeCsv } from "../../../../lib/fournitures-bons";
import { fixText } from "../../../../lib/text";

// Back-office Koji · partenaires (maquette PRO-07.3) : fiche du fournisseur
// partenaire et import de sa mercuriale (modèle CSV), avec contrôles ;
// seules les lignes valides sont publiées, la date de validité est
// obligatoire. Réservé aux comptes admin vérifiés.
const texte = (v, max = 200) => fixText(String(v ?? "")).replace(/\s+/g, " ").trim().slice(0, max);

async function admin(request, body) {
  const userId = await getVerifiedUserId(request, body);
  if (!userId || !(await isVerifiedUserAdmin(userId))) return null;
  return userId;
}

const dateIso = (v) => {
  const s = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
};

export async function GET(request) {
  if (!(await admin(request))) return badRequest("Réservé à l'équipe Koji.", 403);
  const db = await readDb();
  return ok({
    partenaires: (db.partenaires || []).map(({ articles, ...p }) => ({ ...p, articles: (articles || []).length })),
    recommandations: (db.recommandationsFournisseurs || []).slice(0, 50)
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const adminId = await admin(request, body);
  if (!adminId) return badRequest("Réservé à l'équipe Koji.", 403);
  const db = await readDb();
  if (!Array.isArray(db.partenaires)) db.partenaires = [];

  if (body.action === "enregistrer") {
    const nom = texte(body.nom, 120);
    if (!nom) return badRequest("Nom du partenaire obligatoire.");
    const email = texte(body.email, 160);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("E-mail de commande invalide.");
    let p = body.id ? db.partenaires.find((x) => x.id === body.id) : null;
    const champs = {
      nom,
      email,
      metiers: texte(body.metiers, 120),
      zone: texte(body.zone, 120),
      adresse: texte(body.adresse, 200),
      livraison: texte(body.livraison, 80),
      franco: texte(body.franco, 60),
      code: texte(body.code, 30).toUpperCase() || `${nom.split(/\s+/).pop().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)}-KJ`
    };
    if (p) Object.assign(p, champs);
    else { p = { id: makeToken("part"), ...champs, articles: [], publie: false, createdAt: new Date().toISOString(), creePar: adminId }; db.partenaires.push(p); }
    await writeDb(db);
    return ok({ partenaire: { ...p, articles: p.articles.length } });
  }

  const p = db.partenaires.find((x) => x.id === body.id);
  if (!p) return badRequest("Partenaire introuvable.", 404);

  if (body.action === "importer") {
    const rows = lireMercurialeCsv(String(body.csv || "").slice(0, 3_000_000));
    if (!rows.length) return badRequest("Fichier vide ou illisible (modèle Koji : Référence;Désignation;Conditionnement;Unité;Prix Koji HT;Prix public HT;Validité).");
    const c = controlerMercuriale(rows);
    const validites = c.valides.map((r) => dateIso(r.validite)).filter(Boolean).sort();
    const resume = { fichier: texte(body.fichier, 120), lues: c.lues, valides: c.valides.length, erreurs: c.erreurs, validite: validites[0] || "" };
    if (body.apercu) return ok(resume);
    if (!c.valides.length) return badRequest("Aucune ligne valide à publier.");
    p.articles = c.valides.map((r) => ({
      ref: texte(r.ref, 60) || `${p.code}-${r.ligne}`,
      designation: texte(r.designation, 160),
      conditionnement: texte(r.conditionnement, 60),
      contenance: contenanceDe(r.conditionnement),
      unite: texte(r.unite, 12) || "u",
      prixKoji: r.prixKoji,
      prixPublic: r.prixPublic,
      validite: dateIso(r.validite)
    }));
    p.validite = validites[0] || "";
    p.misAJour = new Date().toISOString().slice(0, 10);
    p.dernierImport = { ...resume, par: adminId, le: new Date().toISOString() };
    p.publie = true;
    await writeDb(db);
    return ok({ ...resume, publie: p.articles.length });
  }

  if (body.action === "publier") {
    p.publie = body.publie === true && (p.articles || []).length > 0;
    await writeDb(db);
    return ok({ partenaire: { ...p, articles: p.articles.length } });
  }
  return badRequest("Action inconnue.");
}
