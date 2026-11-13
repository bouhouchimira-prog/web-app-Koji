const assert = require("assert");
const { profileRowFor, ensureProfileRow, findAuthUserByEmail } = require("../../lib/ensure-profile");

// Faux client admin Supabase : une table users en mémoire + listUsers paginé.
function fauxAdmin({ rows = [], authUsers = [] } = {}) {
  const table = new Map(rows.map((r) => [r.id, { ...r }]));
  const appels = { upserts: [], pages: [] };
  return {
    table,
    appels,
    from(nom) {
      assert.strictEqual(nom, "users");
      return {
        select() {
          return {
            eq(col, val) {
              assert.strictEqual(col, "id");
              return { maybeSingle: async () => ({ data: table.get(val) || null, error: null }) };
            }
          };
        },
        async upsert(row, options) {
          appels.upserts.push({ row, options });
          if (!table.has(row.id)) table.set(row.id, { ...row });
          return { error: null };
        }
      };
    },
    auth: {
      admin: {
        async listUsers({ page, perPage }) {
          appels.pages.push(page);
          return { data: { users: authUsers.slice((page - 1) * perPage, page * perPage) }, error: null };
        }
      }
    }
  };
}

const imed = {
  id: "6865fa77-0000-0000-0000-000000000000",
  email: "Imed.Lachiheb@gmail.com",
  created_at: "2026-08-27T06:26:15.603983Z",
  email_confirmed_at: "2026-08-27T06:26:32Z",
  user_metadata: { name: "Imed Lachiheb", is_pro: true }
};

describe("lib/ensure-profile", () => {
  it("construit la ligne depuis le compte Auth", () => {
    assert.deepStrictEqual(profileRowFor(imed), {
      id: imed.id,
      email: "imed.lachiheb@gmail.com",
      is_pro: true,
      full_name: "Imed Lachiheb",
      email_verified: true,
      created_at: imed.created_at
    });
  });

  it("is_pro : métadonnée d'abord, sinon la valeur par défaut demandée", () => {
    const sans = { ...imed, user_metadata: {} };
    assert.strictEqual(profileRowFor(sans).is_pro, true);
    assert.strictEqual(profileRowFor(sans, { isProFallback: false }).is_pro, false);
    assert.strictEqual(profileRowFor({ ...imed, user_metadata: { is_pro: false } }).is_pro, false);
    assert.strictEqual(profileRowFor({ ...imed, user_metadata: { is_pro: "false" } }).is_pro, false);
    assert.strictEqual(profileRowFor({ ...imed, user_metadata: { is_pro: "true" } }, { isProFallback: false }).is_pro, true);
    assert.strictEqual("full_name" in profileRowFor(sans), false);
  });

  it("crée la ligne manquante et la renvoie", async () => {
    const admin = fauxAdmin();
    const ligne = await ensureProfileRow(admin, imed);
    assert.strictEqual(ligne.email, "imed.lachiheb@gmail.com");
    assert.strictEqual(admin.table.size, 1);
    assert.deepStrictEqual(admin.appels.upserts[0].options, { onConflict: "id", ignoreDuplicates: true });
  });

  it("ne touche jamais une ligne existante", async () => {
    const existante = { id: imed.id, email: "imed.lachiheb@gmail.com", is_pro: false, business_info: { a: 1 } };
    const admin = fauxAdmin({ rows: [existante] });
    const ligne = await ensureProfileRow(admin, imed);
    assert.deepStrictEqual(ligne, existante);
    assert.strictEqual(admin.appels.upserts.length, 0);
  });

  it("retrouve un compte par e-mail sur plusieurs pages, sans tenir compte de la casse", async () => {
    const autres = Array.from({ length: 5 }, (_, i) => ({ id: `u${i}`, email: `autre${i}@exemple.fr` }));
    const admin = fauxAdmin({ authUsers: [...autres, imed] });
    const trouve = await findAuthUserByEmail(admin, " imed.lachiheb@GMAIL.com ", { perPage: 2 });
    assert.strictEqual(trouve.id, imed.id);
    assert.deepStrictEqual(admin.appels.pages, [1, 2, 3]);
  });

  it("renvoie null pour une adresse inconnue ou vide", async () => {
    const admin = fauxAdmin({ authUsers: [imed] });
    assert.strictEqual(await findAuthUserByEmail(admin, "personne@exemple.fr"), null);
    assert.strictEqual(await findAuthUserByEmail(admin, ""), null);
    assert.deepStrictEqual(admin.appels.pages, [1]);
  });
});
