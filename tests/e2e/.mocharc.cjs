module.exports = {
  spec: "tests/e2e/specs/**/*.spec.js",
  timeout: 60000,
  require: ["tests/e2e/support/root-hooks.js"],
  reporter: "spec",
  slow: 5000
};
