"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import "./radar-map.css";

// Carte du Radar (maquette PRO-01, « wmap ») : fond OpenStreetMap aux
// couleurs de la maquette (public/carte/radar-style.json, même fichier que
// l'app Koji Pro), une étiquette de prix par chantier, posée au centre de
// sa maille de ~2 km (lib/radar-position.js) : jamais l'adresse.
// Toucher une étiquette ouvre la ligne du chantier dans la liste, et
// inversement. Molette et glisser à deux doigts seulement avec Ctrl ou
// deux doigts, pour ne pas piéger le défilement de la page.
//
// points : [{ id, lat, lon, label, taken }]

const FRANCE = { center: [2.4, 46.6], zoom: 4.6 };

const TEXTES_FR = {
  "AttributionControl.ToggleAttribution": "Afficher les crédits de la carte",
  "CooperativeGesturesHandler.WindowsHelpText": "Ctrl + molette pour zoomer sur la carte",
  "CooperativeGesturesHandler.MacHelpText": "⌘ + molette pour zoomer sur la carte",
  "CooperativeGesturesHandler.MobileHelpText": "Deux doigts pour déplacer la carte"
};

// Plusieurs chantiers dans la même maille : leurs étiquettes se rangent
// côte à côte au-dessus du même point (décalage à l'écran seulement).
const PAS_ETIQUETTES = 86;

function ecarter(points) {
  const groupes = new Map();
  for (const p of points) {
    const cle = `${p.lat},${p.lon}`;
    groupes.set(cle, [...(groupes.get(cle) || []), p]);
  }
  const sortie = [];
  for (const groupe of groupes.values()) {
    groupe.forEach((p, i) => sortie.push({ ...p, dx: (i - (groupe.length - 1) / 2) * PAS_ETIQUETTES }));
  }
  return sortie;
}

function cadrer(map, points, zone) {
  if (points.length === 1) {
    map.jumpTo({ center: [points[0].lon, points[0].lat], zoom: 12.5 });
  } else if (points.length > 1) {
    const lons = points.map((p) => p.lon);
    const lats = points.map((p) => p.lat);
    map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], {
      // place pour la légende en haut, la légende et le zoom en bas, et
      // l'étiquette qui monte au-dessus du point
      padding: { top: 92, bottom: 60, left: 44, right: 64 },
      maxZoom: 13,
      duration: 0
    });
  } else if (zone) {
    map.jumpTo({ center: [zone.lon, zone.lat], zoom: zone.radiusKm > 40 ? 8 : zone.radiusKm > 15 ? 9.5 : 10.5 });
  } else {
    map.jumpTo(FRANCE);
  }
}

export function RadarMap({ points, selectedId, onSelect, zone, legende, caption, className = "" }) {
  const conteneur = useRef(null);
  const carte = useRef(null);
  const marqueurs = useRef(new Map());
  const maplibre = useRef(null);
  const onSelectRef = useRef(onSelect);
  const [etat, setEtat] = useState("chargement"); // chargement | prete | indisponible
  const cadree = useRef(false);

  onSelectRef.current = onSelect;

  useEffect(() => {
    let detruite = false;
    (async () => {
      try {
        const module = await import("maplibre-gl");
        const lib = module.default || module; // v6 : exports nommés
        if (detruite || !conteneur.current) return;
        // Worker servi par le site (scripts/carte-radar-style.mjs).
        lib.setWorkerUrl(`${window.location.origin}/carte/maplibre-gl-worker-${lib.getVersion()}.mjs`);
        maplibre.current = lib;
        const map = new lib.Map({
          container: conteneur.current,
          style: `${window.location.origin}/carte/radar-style.json`,
          ...FRANCE,
          attributionControl: { compact: true },
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          locale: TEXTES_FR
        });
        map.touchZoomRotate.disableRotation();
        map.on("load", () => {
          // Crédits OpenStreetMap repliés derrière leur bouton « i ».
          const credits = conteneur.current?.querySelector(".maplibregl-ctrl-attrib");
          credits?.removeAttribute("open");
          credits?.classList.remove("maplibregl-compact-show");
          if (!detruite) setEtat("prete");
        });
        map.on("error", (event) => {
          // Une tuile manquante n'empêche pas la carte ; seul l'échec du
          // style la rend inutilisable.
          if (!map.isStyleLoaded() && !detruite && /style/i.test(String(event?.error?.message || ""))) setEtat("indisponible");
        });
        carte.current = map;
      } catch {
        if (!detruite) setEtat("indisponible"); // WebGL absent
      }
    })();
    return () => {
      detruite = true;
      marqueurs.current.forEach((m) => m.remove());
      marqueurs.current.clear();
      carte.current?.remove();
      carte.current = null;
    };
  }, []);

  // Étiquettes de prix, refaites quand la liste change.
  const cleDesPoints = points.map((p) => `${p.id}:${p.lat}:${p.lon}:${p.label}:${p.taken ? 1 : 0}`).join("|");
  useEffect(() => {
    const map = carte.current;
    const lib = maplibre.current;
    if (!map || !lib || etat !== "prete") return;
    marqueurs.current.forEach((m) => m.remove());
    marqueurs.current.clear();
    const places = ecarter(points);
    for (const p of places) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `rm-pin${p.taken ? " done" : ""}`;
      el.setAttribute("aria-label", `${p.label}${p.taken ? ", position prise" : ""}`);
      const span = document.createElement("span");
      span.textContent = p.label;
      el.appendChild(span);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectRef.current?.(p.id);
      });
      const marqueur = new lib.Marker({ element: el, anchor: "bottom", offset: [p.dx, -7] })
        .setLngLat([p.lon, p.lat])
        .addTo(map);
      marqueurs.current.set(p.id, marqueur);
    }
    if (!cadree.current || places.length) {
      cadrer(map, places, zone);
      cadree.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleDesPoints, etat, zone?.lat, zone?.lon]);

  // Étiquette du chantier ouvert dans la liste : soulignée et au premier plan.
  useEffect(() => {
    marqueurs.current.forEach((marqueur, id) => {
      const el = marqueur.getElement();
      const on = id === selectedId;
      el.classList.toggle("sel", on);
      el.style.zIndex = on ? "3" : "";
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const map = carte.current;
    const choisi = marqueurs.current.get(selectedId);
    if (map && choisi && !map.getBounds().contains(choisi.getLngLat())) {
      map.easeTo({ center: choisi.getLngLat(), duration: 400 });
    }
  }, [selectedId, cleDesPoints, etat]);

  return (
    <div className={`rm ${className}`.trim()}>
      <div ref={conteneur} className="rm-canvas" aria-label="Carte des chantiers" role="region" />
      {etat === "indisponible" ? (
        <div className="rm-off">Carte indisponible sur cet appareil. La liste reste complète.</div>
      ) : null}
      {caption ? <span className="rm-chip">{caption}</span> : null}
      {legende ? (
        <div className="rm-legend">
          <span><i className="dot" />Nouveau {legende.nouveaux}</span>
          <span><i className="ring" />Position prise {legende.prises}</span>
        </div>
      ) : null}
      <div className="rm-zoom">
        <button type="button" aria-label="Zoomer" onClick={() => carte.current?.zoomIn()}>+</button>
        <button type="button" aria-label="Dézoomer" onClick={() => carte.current?.zoomOut()}>&minus;</button>
      </div>
    </div>
  );
}
