import Anthropic from "@anthropic-ai/sdk";
import { badRequest, ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { contactDisplayName } from "../../../../lib/contacts";
import { DOCS_VIGILANCE, etatDocument } from "../../../../lib/contacts-pro";
import { fixText } from "../../../../lib/text";

// Dépôt des documents de vigilance par le sous-traitant (maquette
// PRO-10.1) : lien unique reçu par e-mail, sans compte. Koji lit la date
// de validité ; l'entreprise est prévenue. Fichiers dans le bucket privé
// quote_attachments/vigilance/…
export const maxDuration = 60;
const BUCKET = "quote_attachments";
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const jourOk = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? d : "");

function trouver(db, token) {
  if (!token || String(token).length < 16) return null;
  return (db.contacts || []).find((c) => c.vigilanceToken === token && !c.archived) || null;
}

async function nomEntreprise(userId) {
  const { data } = await getSupabaseAdmin().from("users").select("business_info").eq("id", userId).maybeSingle();
  const b = data?.business_info || {};
  return String(b.raisonSociale || b._name || "Votre donneur d'ordre");
}

export async function GET(request, { params }) {
  const { token } = await params;
  const db = await readDb();
  const c = trouver(db, token);
  if (!c) return badRequest("Lien invalide ou expiré.", 404);
  const today = new Date().toISOString().slice(0, 10);
  return ok({
    entreprise: await nomEntreprise(c.userId),
    pour: contactDisplayName(c),
    docs: DOCS_VIGILANCE.filter((d) => c.vigilance?.[d.cle]?.demandeLe || !d.facultatif).map((d) => ({ cle: d.cle, nom: d.nom, aide: d.aide, ...etatDocument(c.vigilance?.[d.cle], d, today), depose: Boolean(c.vigilance?.[d.cle]?.fichier) }))
  });
}

const OUTIL = {
  name: "lire_attestation",
  description: "Lecture d'une attestation administrative d'une entreprise du bâtiment.",
  input_schema: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["urssaf", "kbis", "decennale", "rcpro", "etrangers", "autre"] },
      entreprise: { type: "string" },
      siren: { type: "string" },
      date_document: { type: "string", description: "Date d'émission ou de délivrance, AAAA-MM-JJ" },
      valable_jusqu: { type: "string", description: "Date de fin de validité ou de couverture si elle est écrite, AAAA-MM-JJ" },
      activites: { type: "string", description: "Activités couvertes (décennale)" },
      code_securite: { type: "string", description: "Code de sécurité de l'attestation URSSAF s'il est écrit" }
    },
    required: ["type"]
  }
};

export async function POST(request, { params }) {
  const { token } = await params;
  const body = await request.json().catch(() => ({}));
  const db = await readDb();
  const c = trouver(db, token);
  if (!c) return badRequest("Lien invalide ou expiré.", 404);
  const def = DOCS_VIGILANCE.find((d) => d.cle === body.doc);
  if (!def) return badRequest("Document inconnu.");
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(String(body.data || ""));
  if (!m || !TYPES[m[1]]) return badRequest("Déposez un PDF ou une photo (JPEG, PNG).");
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.length > 3 * 1024 * 1024) return badRequest("Fichier trop lourd (3 Mo au plus).");

  let lu = {};
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const r = await anthropic.messages.create({
        model: "claude-sonnet-5", max_tokens: 800, thinking: { type: "disabled" },
        system: "Tu lis une attestation (URSSAF, Kbis, assurance décennale, responsabilité civile, liste des salariés étrangers). Recopie les dates et mentions telles qu'écrites ; n'invente rien.",
        tools: [OUTIL], tool_choice: { type: "tool", name: OUTIL.name },
        messages: [{ role: "user", content: [m[1] === "application/pdf" ? { type: "document", source: { type: "base64", media_type: m[1], data: m[2] } } : { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } }, { type: "text", text: `Document attendu : ${def.nom}.` }] }]
      });
      lu = r.content.find((b) => b.type === "tool_use")?.input || {};
    } catch {
      lu = {};
    }
  }
  const path = `vigilance/${c.userId}/${c.id}/${def.cle}-${Date.now()}.${TYPES[m[1]]}`;
  const { error } = await getSupabaseAdmin().storage.from(BUCKET).upload(path, buffer, { contentType: m[1], upsert: false });
  if (error) return badRequest("Dépôt impossible pour le moment, réessayez.", 502);
  const now = new Date().toISOString();
  c.vigilance = c.vigilance || {};
  c.vigilance[def.cle] = {
    ...(c.vigilance[def.cle] || {}),
    date: jourOk(lu.date_document) || now.slice(0, 10),
    validJusqu: jourOk(lu.valable_jusqu),
    fichier: { path, type: m[1] },
    deposeLe: now,
    aVerifier: true,
    lu: { type: lu.type || "", entreprise: fixText(String(lu.entreprise || "")).slice(0, 120), siren: String(lu.siren || "").replace(/\D/g, "").slice(0, 14), activites: fixText(String(lu.activites || "")).slice(0, 200), codeSecurite: String(lu.code_securite || "").slice(0, 40), autreDocument: Boolean(lu.type && lu.type !== def.cle && lu.type !== "autre") }
  };
  c.updatedAt = now;
  db.notifications = db.notifications || [];
  db.notifications.unshift({
    id: `notif-${Date.now()}`, userId: c.userId, type: "contact.vigilance",
    title: `${def.nom} déposée · ${contactDisplayName(c)}`,
    message: `Koji a lu la date de validité${c.vigilance[def.cle].validJusqu ? ` (jusqu'au ${c.vigilance[def.cle].validJusqu.split("-").reverse().join("/")})` : ""} : vérifiez le document.`,
    actionUrl: `/contacts?id=${c.id}`, actionLabel: "Voir la fiche", read: false, createdAt: now
  });
  await writeDb(db);
  return ok({ ok: true, lu: { date: c.vigilance[def.cle].date, validJusqu: c.vigilance[def.cle].validJusqu, autreDocument: c.vigilance[def.cle].lu.autreDocument } });
}
