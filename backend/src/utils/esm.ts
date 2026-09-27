/**
 * Dynamically imports an ES module in a compiled CommonJS environment.
 * Constructing the native import dynamically avoids static bundlers (like Vercel's compiler)
 * transpiling it to require(), which throws ERR_REQUIRE_ESM.
 */
export const importEsm = new Function('modulePath', 'return import(modulePath)') as (
  modulePath: string
) => Promise<any>;

// Static hints for @vercel/nft so bundler bundles the ESM modules into Lambda
try {
  require.resolve('better-auth');
  require.resolve('better-auth/adapters/mongodb');
  require.resolve('@better-auth/mongo-adapter');
  require.resolve('better-call');
  require.resolve('better-call/node');
} catch {
  // Tracing hint only
}
