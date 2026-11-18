import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error?.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw error;
      if (!specifier.endsWith(".js") && !specifier.endsWith(".json")) {
        try {
          return nextResolve(`${specifier}.js`, context);
        } catch {
          return nextResolve(`${specifier}/index.js`, context);
        }
      }
      throw error;
    }
  }
});
