// migrate-workers.mjs
//
// Migration des comptes ouvriers de la sous-app legacy (worker/) vers le
// format attendu par le portail ouvrier integre (main app).
//
// - Normalise chaque ouvrier via lib/worker-auth.js::normalizeWorker
// - Genere un loginId si manquant (lib/worker-auth.js::makeWorkerLoginId)
// - Detecte les hash legacy (SHA-256 / plaintext) et les marque pour
//   re-hashage automatique au prochain login (workerPasswordNeedsRehash)
//   sans casser le mot de passe existant.
//
// Usage :
//   node scripts/migrate-workers.mjs            # dry-run (aucune ecriture)
//   node scripts/migrate-workers.mjs --apply     # ecrit dans la base
//
// Securite : ne touche pas aux mots de passe en clair autrement qu'en les
// laissant pour le re-hashage au login. A executer apres sauvegarde de la base.

import { readDb, writeDb } from "../lib/db.js";
import {
  normalizeWorker,
  makeWorkerLoginId,
  workerPasswordNeedsRehash,
  publicWorker,
} from "../lib/worker-auth.js";

const apply = process.argv.includes("--apply");

async function main() {
  const db = await readDb();
  if (!Array.isArray(db.workers)) db.workers = [];

  const before = db.workers.length;
  let normalized = 0;
  let rehashNeeded = 0;
  let loginIdGenerated = 0;

  const usedLoginIds = db.workers.map((w) => w.loginId || w.identifier);

  const migrated = db.workers.map((worker) => {
    const beforeNorm = JSON.stringify(worker);
    const n = normalizeWorker(worker);

    if (!n.loginId) {
      n.loginId = makeWorkerLoginId(db.workers);
      n.identifier = n.loginId;
      loginIdGenerated++;
    }

    if (workerPasswordNeedsRehash(n)) {
      rehashNeeded++;
    }

    if (JSON.stringify(n) !== beforeNorm) normalized++;
    return n;
  });

  console.log("=== Migration ouvriers ===");
  console.log(`Ouvriers trouves      : ${before}`);
  console.log(`Normalises            : ${normalized}`);
  console.log(`loginId generes       : ${loginIdGenerated}`);
  console.log(`Re-hashage necessaire : ${rehashNeeded}`);
  console.log(`Mode                  : ${apply ? "APPLY (ecriture)" : "DRY-RUN (aucune ecriture)"}`);

  if (rehashNeeded > 0) {
    console.log("");
    console.log("Note : les ouvriers marques 're-hashage necessaire' ont un");
    console.log("hash legacy (SHA-256) ou un mot de passe en clair. Le portail");
    console.log("integre les re-hashera automatiquement en scrypt au prochain");
    console.log("login reussi (voir lib/worker-auth.js::workerPasswordNeedsRehash).");
  }

  if (apply) {
    db.workers = migrated;
    await writeDb(db);
    console.log("");
    console.log("Migration appliquee. Sauvegarde recommandee avant toute autre operation.");
  } else {
    console.log("");
    console.log("Dry-run termine. Relancer avec --apply pour ecrire.");
  }
}

main().catch((err) => {
  console.error("Erreur migration :", err);
  process.exit(1);
});
