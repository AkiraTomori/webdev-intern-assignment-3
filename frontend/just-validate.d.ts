// just-validate ships types, but its package.json `exports` hides them from TypeScript.
// "just-validate-types" is a type-only alias (tsconfig paths): no code imports that name at runtime.
// Do not map "just-validate" itself in tsconfig paths: Turbopack follows paths and would bundle the .d.ts, i.e. nothing.
declare module "just-validate" {
  import JustValidate from "just-validate-types";
  export * from "just-validate-types";
  export default JustValidate;
}
