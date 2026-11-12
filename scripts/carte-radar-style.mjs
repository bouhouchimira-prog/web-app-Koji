// Style de la carte du Radar (maquette PRO-01, « wmap ») : on part du style
// « positron » d'OpenFreeMap (tuiles OpenStreetMap gratuites, sans clé,
// usage commercial autorisé) et on reprend les couleurs de la maquette :
// sol #ECEAE3, parcs #CFE0C3, bâti #D8D4CB bordé #C6C1B6, rues blanches
// bordées #CBC6BB, voies ferrées #B5B0A6. Seuls les noms de lieux restent :
// les prix des chantiers sont les seules étiquettes fortes de la carte.
//
// Le même fichier sert au site (maplibre-gl) et à l'app Koji Pro
// (maplibre_gl) : public/carte/radar-style.json, servi par getkoji.io.
//
// Copie aussi le « worker » de maplibre-gl (qui lit les tuiles) dans
// public/carte/maplibre-gl-worker-<version>.mjs : la v6 le cherche à côté
// de son propre fichier, introuvable une fois empaqueté par Next. À relancer
// après chaque mise à jour de maplibre-gl (tests/unit/radar-carte.test.js
// le vérifie).
//
//   node scripts/carte-radar-style.mjs

import { copyFile, readFile, readdir, unlink, writeFile } from "node:fs/promises";

const SOURCE = "https://tiles.openfreemap.org/styles/positron";
const SORTIE = new URL("../public/carte/radar-style.json", import.meta.url);

const SOL = "#ECEAE3";
const PARC = "#CFE0C3";
const EAU = "#C9D3D6";
const BATI = "#D8D4CB";
const BATI_BORD = "#C6C1B6";
const RUE = "#FFFFFF";
const RUE_BORD = "#CBC6BB";
const DISCRET = "#D6D1C6";
const FER = "#B5B0A6";
const TEXTE = "#5B5F66";
const TEXTE_FORT = "#3A3F44";

// Couches retirées : noms de rues, cartouches, aéroports, pays et régions.
const RETIREES = /^(highway-name|highway-shield|road_shield|airport|label_country|label_state)/;

const COULEURS = {
  background: { "background-color": SOL },
  park: { "fill-color": PARC },
  water: { "fill-color": EAU },
  landuse_residential: { "fill-color": "#E7E4DC" },
  landcover_wood: { "fill-color": PARC },
  waterway: { "line-color": EAU },
  building: { "fill-color": BATI, "fill-outline-color": BATI_BORD },
  tunnel_motorway_casing: { "line-color": DISCRET },
  tunnel_motorway_inner: { "line-color": "#F4F2EC" },
  "aeroway-taxiway": { "line-color": DISCRET },
  "aeroway-runway-casing": { "line-color": RUE_BORD },
  "aeroway-area": { "fill-color": "#E4E1D8" },
  "aeroway-runway": { "line-color": RUE },
  road_area_pier: { "fill-color": SOL },
  road_pier: { "line-color": SOL },
  highway_path: { "line-color": "#F7F5F0" },
  highway_minor: { "line-color": RUE, "line-opacity": 1 },
  highway_major_casing: { "line-color": RUE_BORD },
  highway_major_inner: { "line-color": RUE },
  highway_major_subtle: { "line-color": DISCRET },
  highway_motorway_casing: { "line-color": RUE_BORD },
  highway_motorway_inner: { "line-color": ["interpolate", ["linear"], ["zoom"], 5.8, DISCRET, 6, RUE] },
  highway_motorway_subtle: { "line-color": DISCRET },
  highway_motorway_bridge_casing: { "line-color": RUE_BORD },
  highway_motorway_bridge_inner: { "line-color": ["interpolate", ["linear"], ["zoom"], 5.8, DISCRET, 6, RUE] },
  railway_transit: { "line-color": FER },
  railway_transit_dashline: { "line-color": SOL },
  railway_service: { "line-color": FER },
  railway_service_dashline: { "line-color": SOL },
  railway: { "line-color": FER },
  railway_dashline: { "line-color": SOL },
  boundary_3: { "line-color": FER },
  boundary_2: { "line-color": FER },
  boundary_disputed: { "line-color": FER }
};

const ETIQUETTE = { "text-halo-color": SOL, "text-halo-width": 1.2, "text-halo-blur": 0 };

const style = await (await fetch(SOURCE)).json();
style.name = "Koji Radar";
delete style.sources.ne2_shaded;
style.layers = style.layers
  .filter((couche) => !RETIREES.test(couche.id) && couche.source !== "ne2_shaded")
  .map((couche) => {
    const paint = { ...(couche.paint || {}), ...(COULEURS[couche.id] || {}) };
    if (couche.type === "symbol") {
      const fort = /^label_(city|town)/.test(couche.id);
      const eau = /^water/.test(couche.id);
      Object.assign(paint, ETIQUETTE, { "text-color": eau ? "#6F8590" : fort ? TEXTE_FORT : TEXTE });
    }
    return { ...couche, paint };
  });

await writeFile(SORTIE, `${JSON.stringify(style)}\n`);
console.log(`${style.layers.length} couches → ${SORTIE.pathname}`);

const dossier = new URL("../public/carte/", import.meta.url);
const { version } = JSON.parse(await readFile(new URL("../node_modules/maplibre-gl/package.json", import.meta.url), "utf8"));
for (const ancien of await readdir(dossier)) {
  if (/^maplibre-gl-worker-.*\.mjs$/.test(ancien)) await unlink(new URL(ancien, dossier));
}
await copyFile(
  new URL("../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url),
  new URL(`maplibre-gl-worker-${version}.mjs`, dossier)
);
console.log(`worker maplibre-gl ${version} copié`);
