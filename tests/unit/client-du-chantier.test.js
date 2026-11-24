import assert from "node:assert/strict";
import { ROLE_CLIENT, clientDuChantier, decouperNom, importerClientsDesChantiers, rattacherClient, resumeClient } from "../../lib/client-du-chantier.js";

// Retours du build 64, sprint 2 : le client d'un chantier ajouté à la main
// n'avait pas de nom (la liste affichait le début de son e-mail) et n'entrait
// pas dans le carnet de contacts.
const QUAND = "2026-11-24T10:00:00Z";

describe("Client d'un chantier ajouté à la main", () => {
  it("crée le contact et le rattache au chantier", () => {
    const db = {};
    const c = rattacherClient(db, "u1", "ch1", { nom: "Marie Lefèvre", email: "Marie@Exemple.fr", telephone: "06 12 34 56 78", adresse: "12 rue de Paris, 93100 Montreuil" }, QUAND);
    assert.equal(c.firstName, "Marie");
    assert.equal(c.lastName, "Lefèvre");
    assert.equal(c.email, "marie@exemple.fr");
    assert.deepEqual(c.roles, [ROLE_CLIENT]);
    assert.equal(c.source, "chantier");
    assert.equal(db.contacts.length, 1);
    assert.deepEqual(db.chantierContacts.map((l) => [l.userId, l.contactId, l.projectId, l.roleOnSite]), [["u1", c.id, "ch1", "client"]]);
    assert.deepEqual(resumeClient(clientDuChantier(db, "u1", "ch1")), { clientName: "Marie Lefèvre", clientPhone: "06 12 34 56 78", contactId: c.id });
  });

  it("reprend le contact existant (même e-mail ou même téléphone) sans rien écraser", () => {
    const db = { contacts: [{ id: "c9", userId: "u1", type: "particulier", firstName: "Marie", lastName: "Lefèvre", email: "marie@exemple.fr", phone: "", roles: ["prospect"] }], chantierContacts: [] };
    const c = rattacherClient(db, "u1", "ch2", { nom: "M. Lefevre", email: "marie@exemple.fr", telephone: "0612345678" }, QUAND);
    assert.equal(c.id, "c9");
    assert.equal(db.contacts.length, 1, "pas de doublon dans le carnet");
    assert.equal(c.lastName, "Lefèvre", "le nom déjà saisi est gardé");
    assert.equal(c.phone, "0612345678", "le téléphone manquant est complété");
    assert.deepEqual(c.roles, ["prospect", "client"]);
    // Deuxième appel : toujours un seul lien.
    rattacherClient(db, "u1", "ch2", { email: "marie@exemple.fr" }, QUAND);
    assert.equal(db.chantierContacts.length, 1);
  });

  it("ne fait rien sans rien de saisi, et ne mélange pas les comptes", () => {
    const db = { contacts: [{ id: "c9", userId: "u2", email: "marie@exemple.fr", roles: ["client"] }] };
    assert.equal(rattacherClient(db, "u1", "ch1", {}, QUAND), null);
    const c = rattacherClient(db, "u1", "ch1", { email: "marie@exemple.fr" }, QUAND);
    assert.notEqual(c.id, "c9", "le contact d'un autre compte n'est jamais repris");
    assert.equal(clientDuChantier(db, "u2", "ch1"), null);
    assert.deepEqual(resumeClient(null), { clientName: "", clientPhone: "", contactId: "" });
  });

  it("fait entrer dans le carnet le client des chantiers déjà créés", () => {
    const db = {};
    const chantiers = [
      { projectId: "ch1", title: "TEST 2", address: "12 rue de Paris, 93100 Montreuil", clientEmail: "imed@exemple.fr" },
      { projectId: "ch2", title: "loft durant test", clientEmail: "" }
    ];
    assert.equal(importerClientsDesChantiers(db, "u1", chantiers, QUAND), 1);
    assert.equal(clientDuChantier(db, "u1", "ch1").email, "imed@exemple.fr");
    assert.equal(clientDuChantier(db, "u1", "ch2"), null);
    assert.equal(importerClientsDesChantiers(db, "u1", chantiers, QUAND), 0, "rien à refaire la fois suivante");
  });

  it("découpe le nom", () => {
    assert.deepEqual(decouperNom("  Marie  Anne Lefèvre "), { firstName: "Marie", lastName: "Anne Lefèvre" });
    assert.deepEqual(decouperNom("Lefèvre"), { firstName: "", lastName: "Lefèvre" });
    assert.deepEqual(decouperNom(""), { firstName: "", lastName: "" });
  });
});
