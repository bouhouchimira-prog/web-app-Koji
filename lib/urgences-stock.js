import { getSupabaseAdmin, hasSupabaseAdmin } from "./supabase.js";

// Urgences (maquette PRO-17) : stockage dans la table Supabase `urgences`
// (supabase/migrations/0014_urgences.sql), une ligne par urgence avec un
// numéro de version.
//
// Pourquoi une table : dans le gros bloc JSON (koji_web_state) la dernière
// écriture gagne. Deux artisans qui acceptaient la même urgence au même
// instant pouvaient tous deux croire l'avoir obtenue. Ici chaque écriture dit
// « modifie la ligne seulement si elle est encore à la version que j'ai lue » :
// la base n'en laisse passer qu'une, l'autre requête relit la ligne et rejoue
// sa règle (« déjà prise par un autre artisan »).
//
// Tant que la table n'existe pas (script pas encore exécuté) ou sans clé de
// service (poste de développement), tout reste dans le bloc comme avant :
// mode « bloc ». Le reste du code lit toujours `db.urgences`.
const TABLE = "urgences";
const ACTIVES = ["recherche", "acceptee"];
const ID_SUR = /^[A-Za-z0-9_.:@+-]{1,120}$/;
const RECENT_MS = 15 * 60 * 1000;
const REESSAI_MS = 30 * 1000;
const LIMITE = 1000;

let absenteJusqua = 0;

const copie = (o) => JSON.parse(JSON.stringify(o));
const ms = (iso) => Date.parse(iso || "") || 0;

export const ligneDe = (u) => ({
  id: String(u.id),
  client_id: String(u.clientId || ""),
  artisan_id: u.artisan?.userId ? String(u.artisan.userId) : null,
  statut: String(u.statut || ""),
  donnees: u
});

export const tableManquante = (error) =>
  ["PGRST205", "42P01"].includes(error?.code) || /could not find the table|relation .* does not exist/i.test(String(error?.message || ""));

// Accès à la table. Les tests passent un adaptateur en mémoire qui suit les
// mêmes règles (une modification ne passe que si la version correspond).
export function adaptateurSupabase(client) {
  const t = () => client.from(TABLE);
  return {
    // Urgences utiles à une requête : celles en cours pour tout le monde
    // (recherche, attente de confirmation), celles de la personne connectée,
    // et celles qui viennent de bouger (« prise par un autre »).
    async lire({ pour = "", ids = [], maintenant = new Date().toISOString() } = {}) {
      const base = () => t().select("id, version, donnees");
      const finir = async (q) => {
        const { data, error } = await q.order("updated_at", { ascending: false }).limit(LIMITE);
        if (error) throw error;
        return data || [];
      };
      if (ids.length) return finir(base().in("id", ids));
      const communes = [`statut.in.(${ACTIVES.join(",")})`, `updated_at.gt."${new Date(ms(maintenant) - RECENT_MS).toISOString()}"`];
      if (!pour) return finir(base().or(communes.join(",")));
      // Une seule requête quand l'identifiant s'écrit sans risque dans le
      // filtre ; sinon trois requêtes où il passe en paramètre.
      if (ID_SUR.test(pour)) return finir(base().or([...communes, `client_id.eq."${pour}"`, `artisan_id.eq."${pour}"`].join(",")));
      const lots = await Promise.all([finir(base().or(communes.join(","))), finir(base().eq("client_id", pour)), finir(base().eq("artisan_id", pour))]);
      const parId = new Map();
      for (const ligne of lots.flat()) if (!parId.has(ligne.id)) parId.set(ligne.id, ligne);
      return [...parId.values()];
    },
    // true = créée ; false = une ligne porte déjà cet identifiant.
    async inserer(ligne) {
      const { error } = await t().insert({ ...ligne, version: 1 });
      if (!error) return true;
      if (error.code === "23505") return false;
      throw error;
    },
    // true = modifiée ; false = la ligne n'est plus à cette version.
    async modifier(ligne, version) {
      const { id, ...champs } = ligne;
      const { data, error } = await t()
        .update({ ...champs, version: version + 1, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("version", version)
        .select("id");
      if (error) throw error;
      return (data || []).length === 1;
    },
    // Reprise des urgences restées dans le bloc : jamais par-dessus une ligne
    // qui existe déjà.
    async importer(lignes) {
      const { error } = await t().upsert(lignes.map((l) => ({ ...l, version: 1 })), { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    }
  };
}

function adaptateurParDefaut() {
  if (!hasSupabaseAdmin || Date.now() < absenteJusqua) return null;
  return adaptateurSupabase(getSupabaseAdmin());
}

function placer(db, u) {
  db.urgences = db.urgences || [];
  const k = db.urgences.findIndex((x) => x.id === u.id);
  if (k === -1) db.urgences.unshift(u);
  else db.urgences[k] = u;
}

// Mode « bloc » : les urgences vivent dans db.urgences et partent avec le bloc.
function stockBloc(db) {
  db.urgences = db.urgences || [];
  return {
    mode: "bloc",
    async sauver(base, u) { placer(base, u); return true; },
    async enregistrer() { return new Set(); }
  };
}

// Charge les urgences dans db.urgences et renvoie le « stock » qui sait les
// enregistrer. [pour] : identifiant de la personne connectée. [ids] : ne
// charger que ces urgences (suite d'une intervention).
export async function ouvrirUrgences(db, { pour = "", ids = null, maintenant = new Date().toISOString(), adaptateur } = {}) {
  const injecte = adaptateur !== undefined;
  const a = injecte ? adaptateur : adaptateurParDefaut();
  if (!a) return stockBloc(db);

  let lignes;
  try {
    const restes = (Array.isArray(db.urgences) ? db.urgences : []).filter((u) => u?.id);
    if (restes.length) await a.importer(restes.map(ligneDe));
    lignes = await a.lire({ pour: String(pour || ""), ids: ids || [], maintenant });
  } catch (error) {
    if (!tableManquante(error)) throw error;
    if (!injecte) absenteJusqua = Date.now() + REESSAI_MS;
    return stockBloc(db);
  }

  const connues = new Map(); // id -> { version, json }
  const poser = (ligne) => {
    connues.set(ligne.id, { version: Number(ligne.version) || 1, json: JSON.stringify(ligne.donnees) });
    return copie(ligne.donnees);
  };
  db.urgences = lignes.map(poser).sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));

  // Une autre requête a écrit avant nous : on repart de la ligne telle
  // qu'elle est en base.
  async function relire(base, id) {
    const [ligne] = await a.lire({ ids: [id], maintenant });
    const k = (base.urgences || []).findIndex((x) => x.id === id);
    if (!ligne) {
      connues.delete(id);
      if (k !== -1) base.urgences.splice(k, 1);
      return;
    }
    placer(base, poser(ligne));
  }

  const stock = {
    mode: "table",
    // Enregistre une urgence. true = c'est fait (ou rien n'avait changé) ;
    // false = elle avait changé entre-temps, db.urgences porte la version
    // à jour et rien n'a été écrit.
    async sauver(base, u) {
      const connue = connues.get(u.id);
      const json = JSON.stringify(u);
      if (connue && connue.json === json) { placer(base, u); return true; }
      const fait = connue ? await a.modifier(ligneDe(u), connue.version) : await a.inserer(ligneDe(u));
      if (!fait) { await relire(base, u.id); return false; }
      connues.set(u.id, { version: connue ? connue.version + 1 : 1, json });
      placer(base, u);
      return true;
    },
    // Enregistre toutes les urgences modifiées en mémoire. Renvoie les
    // identifiants de celles qu'une autre requête a modifiées avant nous.
    async enregistrer(base) {
      const conflits = new Set();
      for (const u of [...(base.urgences || [])]) {
        if (!(await stock.sauver(base, u))) conflits.add(u.id);
      }
      return conflits;
    }
  };
  return stock;
}

// Applique une règle à une urgence et l'enregistre, en rejouant la règle sur
// la ligne à jour si elle a changé entre la lecture et l'écriture.
// [modifier](u) change u et renvoie "" ou un message d'erreur.
// Renvoie { u, change } ou { erreur, u }.
export async function modifierUrgence(stock, db, id, modifier, essais = 5) {
  for (let k = 0; k < essais; k += 1) {
    const actuelle = (db.urgences || []).find((x) => x.id === id);
    if (!actuelle) return { erreur: "Urgence introuvable.", introuvable: true };
    const avant = JSON.stringify(actuelle);
    const essai = JSON.parse(avant);
    const erreur = modifier(essai);
    if (erreur) return { erreur, u: actuelle };
    if (JSON.stringify(essai) === avant) return { u: actuelle, change: false };
    if (await stock.sauver(db, essai)) return { u: essai, change: true };
  }
  return { erreur: "Cette urgence vient de changer. Réessayez.", u: (db.urgences || []).find((x) => x.id === id) || null };
}

// Écrit le bloc. En mode « table », les urgences n'y sont plus : la clé est
// retirée de ce qui part, puis remise en mémoire pour la suite de la requête.
export async function ecrireBloc(db, stock, ecrire) {
  if (stock?.mode !== "table") return ecrire(db);
  const urgences = db.urgences;
  delete db.urgences;
  try {
    return await ecrire(db);
  } finally {
    db.urgences = urgences;
  }
}
