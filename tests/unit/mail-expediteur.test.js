const assert = require("assert");
const { configNoreply } = require("../../lib/mail-expediteur");

describe("lib/mail-expediteur", () => {
  const base = { SMTP_HOST: "smtp.hostinger.com", SMTP_PORT: "587", SMTP_USER: "contact@getkoji.io", SMTP_PASS: "x" };

  it("e-mails de compte depuis noreply@ quand la boîte est configurée", () => {
    assert.deepStrictEqual(
      configNoreply({ ...base, SMTP_NOREPLY_USER: " noreply@getkoji.io ", SMTP_NOREPLY_PASS: "secret" }),
      { host: "smtp.hostinger.com", port: 587, user: "noreply@getkoji.io", pass: "secret", from: "Koji <noreply@getkoji.io>" }
    );
  });

  it("port par défaut 587, 465 respecté", () => {
    const env = { SMTP_HOST: "h", SMTP_NOREPLY_USER: "n@k.io", SMTP_NOREPLY_PASS: "p" };
    assert.strictEqual(configNoreply(env).port, 587);
    assert.strictEqual(configNoreply({ ...env, SMTP_PORT: "465" }).port, 465);
  });

  it("variables absentes : rien ne change (tout part de SMTP_USER)", () => {
    assert.strictEqual(configNoreply(base), null);
    assert.strictEqual(configNoreply({ ...base, SMTP_NOREPLY_USER: "noreply@getkoji.io" }), null);
    assert.strictEqual(configNoreply({ SMTP_NOREPLY_USER: "n@k.io", SMTP_NOREPLY_PASS: "p" }), null);
  });
});
