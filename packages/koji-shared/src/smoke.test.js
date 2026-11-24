import { test } from "node:test";
import assert from "node:assert/strict";
import * as text from "./text.js";
import * as validators from "./validators.js";
import * as passwordHash from "./password-hash.js";

test("@koji/shared text helpers work", () => {
  assert.equal(typeof text.fixText("bonjour"), "string");
  assert.equal(text.fixText(42), 42);
});

test("@koji/shared validators work", () => {
  assert.equal(validators.required("x", "f"), null);
  assert.equal(validators.isEmail("a@b.com"), null);
  assert.equal(typeof validators.required("", "f"), "string");
});

test("@koji/shared password-hash round-trips", async () => {
  const { hash, salt } = passwordHash.hashPassword("secret");
  assert.ok(hash && salt);
  const ok = passwordHash.verifyHashedPassword("secret", salt, hash);
  assert.equal(ok, true);
});
