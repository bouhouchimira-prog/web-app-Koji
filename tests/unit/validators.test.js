const assert = require("assert");
const { required, maxLength, isEmail, validateFields } = require("../../lib/validators");

describe("lib/validators", () => {
  describe("required", () => {
    it("rejette undefined/null/vide", () => {
      assert.strictEqual(required(undefined), "Ce champ est requis.");
      assert.strictEqual(required(null), "Ce champ est requis.");
      assert.strictEqual(required(""), "Ce champ est requis.");
      assert.strictEqual(required("   "), "Ce champ est requis.");
      assert.strictEqual(required([]), "Ce champ est requis.");
    });
    it("accepte une valeur non vide", () => {
      assert.strictEqual(required("ok"), null);
      assert.strictEqual(required(["a"]), null);
      assert.strictEqual(required(0), null);
    });
    it("utilise le nom de champ", () => {
      assert.strictEqual(required("", "Le nom"), "Le nom est requis.");
    });
  });

  describe("maxLength", () => {
    it("rejette si trop long", () => {
      assert.strictEqual(
        maxLength("abcde", 3, "Le nom"),
        "Le nom ne doit pas dépasser 3 caractères."
      );
    });
    it("accepte si dans la limite", () => {
      assert.strictEqual(maxLength("abc", 3), null);
      assert.strictEqual(maxLength(123, 3), null);
    });
  });

  describe("isEmail", () => {
    it("rejette un email invalide", () => {
      assert.strictEqual(isEmail("pas-un-email"), "Adresse email invalide.");
      assert.strictEqual(isEmail("a@"), "Adresse email invalide.");
    });
    it("accepte un email valide", () => {
      assert.strictEqual(isEmail("a@b.com"), null);
    });
    it("ignore les valeurs vides (required gère ça)", () => {
      assert.strictEqual(isEmail(""), null);
      assert.strictEqual(isEmail(null), null);
    });
  });

  describe("validateFields", () => {
    it("retourne la première erreur", () => {
      const err = validateFields(
        { name: "", email: "bad" },
        {
          name: [(v) => required(v, "Le nom")],
          email: [(v) => isEmail(v)]
        }
      );
      assert.strictEqual(err, "Le nom est requis.");
    });
    it("retourne null si tout est valide", () => {
      const err = validateFields(
        { name: "Bob", email: "bob@x.com" },
        {
          name: [(v) => required(v, "Le nom"), (v) => maxLength(v, 10, "Le nom")],
          email: [(v) => isEmail(v)]
        }
      );
      assert.strictEqual(err, null);
    });
  });
});
