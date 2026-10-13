// YAML data files are turned into plain objects at build time (esbuild plugin in
// extension/scripts/build.mjs, Vite plugin in vitest.config.ts). Nothing parses YAML at runtime.
declare module '*.yaml' {
  const data: unknown;
  export default data;
}
