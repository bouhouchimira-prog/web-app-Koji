const assert = require("assert");
const fs = require("fs");
const path = require("path");

// La carte du Radar charge public/carte/maplibre-gl-worker-<version>.mjs :
// après une mise à jour de maplibre-gl, relancer scripts/carte-radar-style.mjs.
describe("carte du Radar", () => {
  const racine = path.join(__dirname, "..", "..");

  it("sert le worker de la version installée de maplibre-gl", () => {
    const { version } = JSON.parse(fs.readFileSync(path.join(racine, "node_modules/maplibre-gl/package.json"), "utf8"));
    assert.ok(
      fs.existsSync(path.join(racine, `public/carte/maplibre-gl-worker-${version}.mjs`)),
      `public/carte/maplibre-gl-worker-${version}.mjs manquant : node scripts/carte-radar-style.mjs`
    );
  });

  it("garde le style aux couleurs de la maquette, sans noms de rues", () => {
    const style = JSON.parse(fs.readFileSync(path.join(racine, "public/carte/radar-style.json"), "utf8"));
    const couche = (id) => style.layers.find((l) => l.id === id);
    assert.strictEqual(couche("background").paint["background-color"], "#ECEAE3");
    assert.strictEqual(couche("park").paint["fill-color"], "#CFE0C3");
    assert.strictEqual(couche("building").paint["fill-color"], "#D8D4CB");
    assert.ok(!style.layers.some((l) => /^highway-name/.test(l.id)));
  });
});
