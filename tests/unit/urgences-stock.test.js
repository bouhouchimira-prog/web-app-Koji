import assert from "node:assert/strict";
import { accepter } from "../../lib/urgences.js";
import { ecrireBloc, ligneDe, modifierUrgence, ouvrirUrgences, tableManquante } from "../../lib/urgences-stock.js";
import { avancerRecherches, avancerTout, creerIntervention, reparer } from "../../lib/urgences-serveur.js";

// Table `urgences` en mémoire, avec la règle de la vraie : une modification
// ne passe que si la ligne est encore à la version lue. Chaque appel rend la
// main avant d'agir, comme un aller-retour réseau : deux requêtes lancées
// ensemble se croisent vraiment.
const copie = (o) => JSON.parse(JSON.stringify(o));
const tic = () => new Promise((r) => setImmediate(r));
function fausseTable(urgences = []) {
  const lignes = new Map(urgences.map((u) => [u.id, { ...copie(ligneDe(u)), version: 1 }]));
  const adaptateur = {
    async lire({ pour = "", ids = [] } = {}) {
      await tic();
      const toutes = [...lignes.values()];
      const choix = ids.length ? toutes.filter((l) => ids.includes(l.id)) : toutes.filter((l) => ["recherche", "acceptee"].includes(l.statut) || l.client_id === pour || l.artisan_id === pour);
      return choix.map(copie);
    },
    async inserer(ligne) {
      await tic();
      if (lignes.has(ligne.id)) return false;
      lignes.set(ligne.id, { ...copie(ligne), version: 1 });
      return true;
    },
    async modifier(ligne, version) {
      await tic();
      const actuelle = lignes.get(ligne.id);
      if (!actuelle || actuelle.version !== version) return false;
      lignes.set(ligne.id, { ...copie(ligne), version: version + 1 });
      return true;
    },
    async importer(nouvelles) {
      await tic();
      for (const l of nouvelles) if (!lignes.has(l.id)) lignes.set(l.id, { ...copie(l), version: 1 });
    }
  };
  return { lignes, adaptateur };
}

// Maquette PRO-17 : Mme Lefèvre, fuite sous l'évier, Paris 10e.
const T0 = "2026-10-30T09:16:00.000Z";
const plus = (s) => new Date(Date.parse(T0) + s * 1000).toISOString();
const PRIX = { deplacement: 89, demiHeure: 35 };
const proposition = (userId) => ({ userId, distanceKm: 1.2, le: T0, refuseeLe: "", relanceeLe: "" });
const urgence = (extra = {}) => ({
  id: "urg-1", clientId: "cli-1", nomClient: "Claire Lefèvre", telephone: "06 00 00 00 00", categorie: "fuite", reponses: { ou: "Sous l'évier", coupee: "Oui" },
  adresse: "12 Rue Exemple 75010 Paris", lat: 48.8722, lon: 2.3601, quartier: "Paris 10e", statut: "recherche",
  propositions: [proposition("art-1"), proposition("art-2"), proposition("art-3")], artisan: null, createdAt: T0, rechercheDepuis: T0, ...extra
});

// Une « requête » d'artisan : elle lit, puis accepte.
async function requeteAccepter(adaptateur, userId, maintenant = plus(20)) {
  const db = {};
  const stock = await ouvrirUrgences(db, { pour: userId, adaptateur, maintenant });
  return modifierUrgence(stock, db, "urg-1", (u) => accepter(u, { userId, minutes: 10, prix: PRIX, maintenant }));
}

describe("Urgences : table dédiée (le premier qui accepte l'obtient)", () => {
  it("deux artisans acceptent au même instant : un seul l'obtient, l'autre lit « déjà prise »", async () => {
    const { lignes, adaptateur } = fausseTable([urgence()]);
    const [a, b] = await Promise.all([requeteAccepter(adaptateur, "art-1"), requeteAccepter(adaptateur, "art-2")]);
    const gagnants = [a, b].filter((r) => !r.erreur && r.change);
    const perdants = [a, b].filter((r) => r.erreur);
    assert.equal(gagnants.length, 1);
    assert.equal(perdants.length, 1);
    assert.equal(perdants[0].erreur, "Cette urgence a déjà été prise par un autre artisan.");
    const ligne = lignes.get("urg-1");
    assert.equal(ligne.statut, "acceptee");
    assert.equal(ligne.artisan_id, gagnants[0].u.artisan.userId);
    assert.equal(ligne.donnees.artisan.userId, ligne.artisan_id);
    assert.equal(ligne.version, 2);
    // Le perdant voit en mémoire l'urgence telle qu'elle est en base.
    assert.equal(perdants[0].u.artisan.userId, ligne.artisan_id);
  });

  it("trois artisans en même temps, dix fois de suite : toujours un seul gagnant", async () => {
    for (let tour = 0; tour < 10; tour += 1) {
      const { lignes, adaptateur } = fausseTable([urgence()]);
      const reponses = await Promise.all(["art-1", "art-2", "art-3"].map((id) => requeteAccepter(adaptateur, id)));
      assert.equal(reponses.filter((r) => !r.erreur && r.change).length, 1);
      assert.equal(reponses.filter((r) => r.erreur === "Cette urgence a déjà été prise par un autre artisan.").length, 2);
      assert.equal(lignes.get("urg-1").version, 2);
    }
  });

  it("une nouvelle vague écrite entre la lecture et l'acceptation ne fait pas perdre l'artisan", async () => {
    const { lignes, adaptateur } = fausseTable([urgence({ propositions: [proposition("art-1")] })]);
    const dbA = {};
    const stockA = await ouvrirUrgences(dbA, { pour: "art-1", adaptateur });
    // Pendant ce temps, une autre lecture ajoute un artisan à la recherche.
    const dbB = {};
    const stockB = await ouvrirUrgences(dbB, { pour: "art-9", adaptateur });
    dbB.urgences[0].propositions.push(proposition("art-4"));
    assert.equal((await stockB.enregistrer(dbB)).size, 0);
    // L'artisan accepte avec sa lecture d'avant : la règle est rejouée.
    const r = await modifierUrgence(stockA, dbA, "urg-1", (u) => accepter(u, { userId: "art-1", minutes: 10, prix: PRIX, maintenant: plus(20) }));
    assert.equal(r.erreur, undefined);
    assert.equal(r.change, true);
    const ligne = lignes.get("urg-1");
    assert.equal(ligne.artisan_id, "art-1");
    assert.deepEqual(ligne.donnees.propositions.map((p) => p.userId), ["art-1", "art-4"]);
    assert.equal(ligne.version, 3);
  });

  it("accepter une urgence qu'on a déjà obtenue ne change rien (pas de seconde notification)", async () => {
    const { lignes, adaptateur } = fausseTable([urgence()]);
    assert.equal((await requeteAccepter(adaptateur, "art-1")).change, true);
    const encore = await requeteAccepter(adaptateur, "art-1");
    assert.equal(encore.erreur, undefined);
    assert.equal(encore.change, false);
    assert.equal(lignes.get("urg-1").version, 2);
  });

  it("une règle refusée laisse l'urgence intacte, en mémoire et en base", async () => {
    const { lignes, adaptateur } = fausseTable([urgence()]);
    const db = {};
    const stock = await ouvrirUrgences(db, { pour: "art-1", adaptateur });
    const r = await modifierUrgence(stock, db, "urg-1", (u) => { u.statut = "annulee"; return "Refusé."; });
    assert.equal(r.erreur, "Refusé.");
    assert.equal(db.urgences[0].statut, "recherche");
    assert.equal(lignes.get("urg-1").version, 1);
    assert.equal((await modifierUrgence(stock, db, "inconnue", () => "")).introuvable, true);
  });

  it("deux confirmations au même instant : une seule prépare l'intervention", async () => {
    const acceptee = urgence({ statut: "acceptee", artisan: { userId: "art-1", accepteLe: plus(20), minutes: 10, arriveeVers: "10:26", prix: PRIX, distanceKm: 1.2 } });
    const { lignes, adaptateur } = fausseTable([acceptee]);
    const confirmer = async (prevue) => {
      const db = {};
      const stock = await ouvrirUrgences(db, { pour: "cli-1", adaptateur });
      return modifierUrgence(stock, db, "urg-1", (u) => {
        if (u.statut === "confirmee") return "";
        if (u.statut !== "acceptee") return "Rien à confirmer.";
        Object.assign(u, { statut: "confirmee", confirmeeLe: plus(60), interventionId: prevue });
        return "";
      });
    };
    const [a, b] = await Promise.all([confirmer("int-a"), confirmer("int-b")]);
    assert.equal([a, b].filter((r) => r.change).length, 1);
    assert.equal([a, b].filter((r) => !r.erreur && !r.change).length, 1);
    const gardee = lignes.get("urg-1").donnees.interventionId;
    assert.ok(["int-a", "int-b"].includes(gardee));
    assert.equal(a.u.interventionId, gardee);
    assert.equal(b.u.interventionId, gardee);
  });

  it("une nouvelle urgence est créée une seule fois", async () => {
    const { lignes, adaptateur } = fausseTable();
    const db = {};
    const stock = await ouvrirUrgences(db, { pour: "cli-1", adaptateur });
    assert.equal(stock.mode, "table");
    assert.equal(await stock.sauver(db, urgence({ propositions: [] })), true);
    assert.equal(db.urgences.length, 1);
    assert.equal(lignes.get("urg-1").client_id, "cli-1");
    // Rien n'a changé : pas d'écriture.
    assert.equal((await stock.enregistrer(db)).size, 0);
    assert.equal(lignes.get("urg-1").version, 1);
  });

  it("deux lectures font avancer la même recherche : une seule garde ses notifications", async () => {
    const reglages = Object.fromEntries(["art-1", "art-2"].map((id) => [id, { actif: true, jusqua: plus(36000), zone: { lat: 48.872, lon: 2.36, rayonKm: 8 }, prix: { fuite: 89 }, demiHeure: 35 }]));
    const { lignes, adaptateur } = fausseTable([urgence({ propositions: [] })]);
    const lecture = async () => {
      const db = { urgencesPro: reglages, notifications: [] };
      const stock = await ouvrirUrgences(db, { pour: "cli-1", adaptateur, maintenant: plus(1) });
      const pushs = [];
      const aEcrire = await avancerRecherches(db, stock, plus(1), pushs);
      return { db, aEcrire, pushs };
    };
    const [x, y] = await Promise.all([lecture(), lecture()]);
    assert.equal([x, y].filter((r) => r.aEcrire).length, 1);
    const [garde, autre] = x.aEcrire ? [x, y] : [y, x];
    assert.equal(garde.pushs.length, 2);
    assert.equal(garde.db.notifications.length, 2);
    assert.equal(autre.pushs.length, 0);
    assert.equal(autre.db.notifications.length, 0);
    // Les deux voient la même recherche, celle qui est en base.
    assert.deepEqual(autre.db.urgences[0].propositions.map((p) => p.userId), ["art-1", "art-2"]);
    assert.equal(lignes.get("urg-1").version, 2);
  });

  it("avancerTout ne pose rien lui-même : il rend les notifications à poser", () => {
    const db = { urgences: [urgence({ statut: "acceptee", artisan: { userId: "art-1", accepteLe: T0 } })], notifications: [] };
    const effets = avancerTout(db, plus(700));
    assert.equal(db.urgences[0].statut, "expiree");
    assert.equal(db.notifications.length, 0);
    assert.deepEqual(effets.map((e) => e.id), ["urg-1", "urg-1"]);
    const pushs = [];
    effets.forEach((e) => e.appliquer(pushs));
    assert.equal(pushs.length, 2);
    assert.ok(db.notifications.some((n) => n.userId === "cli-1" && n.type === "urgence.expiree"));
    assert.ok(db.notifications.some((n) => n.userId === "art-1" && n.type === "urgence.expiree"));
  });

  it("sans la table, tout reste dans le bloc comme avant", async () => {
    const absente = { async importer() { throw { code: "PGRST205", message: "Could not find the table 'public.urgences' in the schema cache" }; }, async lire() { throw { code: "PGRST205" }; } };
    const db = { urgences: [urgence()] };
    const stock = await ouvrirUrgences(db, { pour: "art-1", adaptateur: absente });
    assert.equal(stock.mode, "bloc");
    assert.equal(db.urgences.length, 1);
    const r = await modifierUrgence(stock, db, "urg-1", (u) => accepter(u, { userId: "art-1", minutes: 10, prix: PRIX, maintenant: plus(20) }));
    assert.equal(r.change, true);
    assert.equal(db.urgences[0].artisan.userId, "art-1");
    let ecrit = null;
    await ecrireBloc(db, stock, async (d) => { ecrit = copie(d); });
    assert.equal(ecrit.urgences.length, 1);
    assert.equal((await ouvrirUrgences({}, { adaptateur: null })).mode, "bloc");
    assert.equal(tableManquante({ code: "42P01" }), true);
    assert.equal(tableManquante({ code: "23505" }), false);
  });

  it("une panne qui n'est pas « table absente » remonte, sans repli silencieux", async () => {
    const enPanne = { async importer() {}, async lire() { throw { code: "57014", message: "canceling statement due to statement timeout" }; } };
    await assert.rejects(() => ouvrirUrgences({}, { adaptateur: enPanne }), (e) => e.code === "57014");
  });

  it("avec la table, le bloc part sans les urgences ; celles restées dans le bloc sont reprises sans rien écraser", async () => {
    const enBase = urgence({ statut: "acceptee", artisan: { userId: "art-2", accepteLe: plus(20) } });
    const { lignes, adaptateur } = fausseTable([enBase]);
    const db = { urgences: [urgence(), urgence({ id: "urg-9", clientId: "cli-9" })], notifications: [] };
    const stock = await ouvrirUrgences(db, { pour: "cli-9", adaptateur });
    assert.equal(lignes.get("urg-1").statut, "acceptee");
    assert.equal(lignes.get("urg-1").artisan_id, "art-2");
    assert.equal(lignes.get("urg-9").client_id, "cli-9");
    assert.deepEqual(db.urgences.map((u) => u.id).sort(), ["urg-1", "urg-9"]);
    assert.equal(db.urgences.find((u) => u.id === "urg-1").statut, "acceptee");
    let ecrit = null;
    await ecrireBloc(db, stock, async (d) => { ecrit = copie(d); });
    assert.equal("urgences" in ecrit, false);
    assert.deepEqual(ecrit.notifications, []);
    assert.equal(db.urgences.length, 2);
    // Même si l'écriture du bloc échoue, les urgences restent en mémoire.
    await assert.rejects(() => ecrireBloc(db, stock, async () => { throw new Error("panne"); }));
    assert.equal(db.urgences.length, 2);
  });

  it("l'intervention d'une urgence confirmée n'est créée qu'une fois, et se répare si le bloc l'a perdue", () => {
    const u = urgence({ statut: "confirmee", confirmeeLe: plus(60), interventionId: "int-prevue", email: "claire@exemple.invalid", artisan: { userId: "art-1", accepteLe: plus(20), minutes: 10, arriveeVers: "10:26", prix: PRIX, distanceKm: 1.2 } });
    const db = { urgences: [u], interventions: [], contacts: [], history: [] };
    const i = creerIntervention(db, u, plus(60));
    assert.equal(i.id, "int-prevue");
    assert.equal(creerIntervention(db, u, plus(61)), i);
    assert.equal(db.interventions.length, 1);
    assert.equal(db.contacts.length, 1);
    // Bloc écrasé par une autre écriture : l'intervention a disparu.
    const perdu = { urgences: [u], interventions: [], contacts: [], history: [] };
    assert.equal(reparer(perdu, plus(65)), false, "trop tôt : l'écriture est peut-être en cours");
    assert.equal(reparer(perdu, plus(120)), true);
    assert.equal(perdu.interventions[0].id, "int-prevue");
    assert.equal(reparer(perdu, plus(130)), false);
    // Urgence annulée en base, intervention encore ouverte dans le bloc.
    const annulee = { ...u, statut: "annulee", annuleeLe: plus(200) };
    const bloc = { urgences: [annulee], interventions: [{ id: "int-prevue", annuleeLe: "", termineeLe: "" }] };
    assert.equal(reparer(bloc, plus(300)), true);
    assert.equal(bloc.interventions[0].annuleeLe, plus(200));
    assert.equal(bloc.interventions[0].status, "annulee");
  });
});
