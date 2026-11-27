import assert from "node:assert/strict";
import { lirePartage, ecrireEnCoupant, couperLecturePartagee, avecLectureUnique } from "../../lib/lecture-partagee.js";

// KPRO-47 : la fiche chantier lance neuf requêtes en même temps ; une seule
// lecture du bloc doit partir, sans mélanger les copies ni servir un état
// d'avant une écriture.
function lecteurCompte(valeur, delai = 20) {
  let appels = 0;
  // Comme une vraie lecture : l'état est pris au départ, reçu après le délai.
  const lire = async () => {
    appels += 1;
    const pris = structuredClone(valeur());
    await new Promise((r) => setTimeout(r, delai));
    return pris;
  };
  return { lire, appels: () => appels };
}

describe("Lecture partagée du bloc (KPRO-47)", () => {
  afterEach(() => couperLecturePartagee());

  it("neuf lectures simultanées ne lisent le bloc qu'une fois", async () => {
    const bloc = { tasks: [{ id: "t1" }], _version: 3 };
    const l = lecteurCompte(() => bloc);
    const resultats = await Promise.all(Array.from({ length: 9 }, () => lirePartage(l.lire)));
    assert.equal(l.appels(), 1);
    for (const r of resultats) assert.deepEqual(r, bloc);
  });

  it("chaque appelant reçoit sa propre copie", async () => {
    const l = lecteurCompte(() => ({ tasks: [] }));
    const [a, b] = await Promise.all([lirePartage(l.lire), lirePartage(l.lire)]);
    a.tasks.push({ id: "ajout" });
    assert.notEqual(a, b);
    assert.deepEqual(b.tasks, []);
  });

  it("une lecture qui suit une lecture terminée relit le bloc", async () => {
    const l = lecteurCompte(() => ({ n: 1 }));
    await lirePartage(l.lire);
    await lirePartage(l.lire);
    assert.equal(l.appels(), 2);
  });

  it("après une écriture, la lecture suivante ne reçoit pas l'état d'avant", async () => {
    let etat = { version: 1 };
    const l = lecteurCompte(() => etat, 40);
    const avant = lirePartage(l.lire); // commencée avant l'écriture
    await ecrireEnCoupant(async () => { etat = { version: 2 }; });
    const apres = await lirePartage(l.lire); // commencée après l'écriture
    assert.equal((await avant).version, 1);
    assert.equal(apres.version, 2);
    assert.equal(l.appels(), 2);
  });

  it("fiche (étape 2) : tout ce qui s'exécute dans avecLectureUnique lit une seule fois, même en décalé", async () => {
    const l = lecteurCompte(() => ({ tasks: [] }));
    await avecLectureUnique(async () => {
      await Promise.all([lirePartage(l.lire), lirePartage(l.lire)]);
      await lirePartage(l.lire); // une route qui lit plus tard dans la même requête
    });
    assert.equal(l.appels(), 1);
  });

  it("fiche (étape 2) : deux requêtes séparées ne partagent pas leur lecture", async () => {
    const l = lecteurCompte(() => ({ n: 1 }));
    await avecLectureUnique(() => lirePartage(l.lire));
    await avecLectureUnique(() => lirePartage(l.lire));
    assert.equal(l.appels(), 2);
  });

  it("fiche (étape 2) : une écriture pendant la requête force une nouvelle lecture", async () => {
    let etat = { version: 1 };
    const l = lecteurCompte(() => etat);
    await avecLectureUnique(async () => {
      assert.equal((await lirePartage(l.lire)).version, 1);
      await ecrireEnCoupant(async () => { etat = { version: 2 }; });
      assert.equal((await lirePartage(l.lire)).version, 2);
    });
    assert.equal(l.appels(), 2);
  });

  it("une lecture en échec n'est pas gardée pour les suivantes", async () => {
    let echoue = true;
    const lire = async () => {
      if (echoue) { echoue = false; throw new Error("réseau"); }
      return { ok: true };
    };
    await assert.rejects(lirePartage(lire), /réseau/);
    assert.deepEqual(await lirePartage(lire), { ok: true });
  });
});
