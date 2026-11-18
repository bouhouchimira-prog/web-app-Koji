module.exports = {
  spec: "tests/unit/**/*.test.js",
  timeout: 10000,
  reporter: "spec",
  nodeOption: ["import=./tests/unit/esm-resolve-loader.mjs"]
};