/**
 * Dynamically imports an ES module in a compiled CommonJS environment.
 * Constructing the native import dynamically avoids static bundlers (like Vercel's compiler)
 * transpiling it to require(), which throws ERR_REQUIRE_ESM.
 */
export const importEsm = new Function('modulePath', 'return import(modulePath)') as (
  modulePath: string
) => Promise<any>;
