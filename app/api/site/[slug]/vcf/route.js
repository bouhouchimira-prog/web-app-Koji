import { NextResponse } from "next/server";
import { badRequest } from "../../../../../lib/http";
import { readDb, writeDb } from "../../../../../lib/db";
import { getSupabaseAdmin } from "../../../../../lib/supabase";
import { buildWebUser } from "../../../../../lib/user-profile";
import { vcard } from "../../../../../lib/kojipage";
import { compterVcf, urlPublique } from "../../../../../lib/kojipage-serveur";
import { contenuCarte } from "../../../../../lib/kojipage-carte";

// Fiche contact (.vcf) de la carte de visite (maquette PRO-13.4) — route
// PUBLIQUE, comptée dans « contacts enregistrés ».
export async function GET(request, context) {
  const { slug } = await context.params;
  const db = await readDb();
  const site = (db.companySites || []).find((s) => s.slug === slug && s.published);
  if (!site) return badRequest("Carte introuvable.", 404);
  const { data: profile } = await getSupabaseAdmin().from("users").select("*").eq("id", site.userId).maybeSingle();
  const webUser = buildWebUser({ id: site.userId, email: profile?.email || "", profile });
  const carte = contenuCarte(site, webUser);
  compterVcf(db, site);
  await writeDb(db).catch(() => null);
  const fichier = vcard({ nom: carte.nom, personne: carte.personne, fonction: carte.fonction, telephone: carte.telephone, email: carte.email, url: urlPublique(site.slug), adresse: carte.adresse ? carte.adresseTexte : "" });
  return new NextResponse(fichier, { headers: { "Content-Type": "text/vcard; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}.vcf"` } });
}
