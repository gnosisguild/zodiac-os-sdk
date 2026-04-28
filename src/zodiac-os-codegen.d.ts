// Ambient fallbacks. Script file (no imports / exports), so top-level
// interface declarations are implicitly global. Consumers augment these
// via files generated into `<cwd>/.zodiac/` by `zodiac pull-org` /
// `pull-contracts`.

// Augmented by `<cwd>/.zodiac/allow.d.ts` (from `pull-contracts`) with
// narrow per-chain contract typings.
interface AllowKit {}

// Augmented by `<cwd>/.zodiac/index.d.ts` (from `pull-org`) with the
// workspace's users and vaults as literal types. Remains `{}` until
// `pull-org` has been run; `constellation()` falls back to the wide
// `CodegenData` shape in that case.
interface ZodiacGeneratedCodegen {}
