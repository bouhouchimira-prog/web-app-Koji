import assert from "node:assert/strict";
import { actionsDe, categorieDe, estArchivee, groupeDe, grouper, heureListe } from "../../lib/notifications-pro.js";

// Maquette PRO-23 : mardi 3 novembre 2026, 9 h 41 (Paris).
const maintenant = "2026-11-03T08:41:00Z";

describe("Notifications (PRO-23)", () => {
  it("catégorie de chaque type", () => {
    assert.equal(categorieDe("quote.signed"), "devis");
    assert.equal(categorieDe("radar.positionnement"), "radar");
    assert.equal(categorieDe("radar.rdv_confirme"), "rdv");
    assert.equal(categorieDe("worker.rappel_pointage"), "equipe");
    assert.equal(categorieDe("client.note"), "message");
    assert.equal(categorieDe("document.expire"), "document");
    assert.equal(categorieDe("inconnu"), "info");
  });

  it("groupes par jour et heures de la liste", () => {
    assert.equal(groupeDe("2026-11-03T08:12:00Z", maintenant), "Aujourd'hui");
    assert.equal(groupeDe("2026-11-02T17:30:00Z", maintenant), "Hier");
    assert.equal(groupeDe("2026-11-02T00:30:00Z", maintenant), "Hier");
    assert.equal(groupeDe("2026-10-30T10:00:00Z", maintenant), "Octobre 2026");
    assert.equal(heureListe("2026-11-03T08:12:00Z", maintenant), "09:12");
    const g = grouper([{ createdAt: "2026-11-02T17:30:00Z" }, { createdAt: "2026-11-03T08:12:00Z" }, { createdAt: "2026-11-03T07:40:00Z" }], maintenant);
    assert.deepEqual(g.map((x) => [x.titre, x.items.length]), [["Aujourd'hui", 2], ["Hier", 1]]);
  });

  it("archivée après 30 jours", () => {
    assert.equal(estArchivee({ createdAt: "2026-10-01T10:00:00Z" }, maintenant), true);
    assert.equal(estArchivee({ createdAt: "2026-10-20T10:00:00Z" }, maintenant), false);
    assert.equal(estArchivee({ archived: true, createdAt: maintenant }, maintenant), true);
  });

  it("une action principale au plus", () => {
    const a = actionsDe({ actionUrl: "/facturation?quoteId=q1&type=acompte", actionLabel: "Envoyer la facture d'acompte", quoteId: "q1", projectId: "c1" });
    assert.equal(a.principale.label, "Envoyer la facture d'acompte");
    assert.deepEqual(a.secondaires.map((x) => x.label), ["Voir le chantier"]);
    assert.equal(actionsDe({ quoteId: "q1" }).principale.label, "Voir le devis");
  });
});
