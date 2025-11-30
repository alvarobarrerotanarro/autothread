import { build } from "esbuild"

const bresult = await build({
  entryPoints: ["./src/assets/main.ts"],
  outfile: "./dist/assets/main.js",
  bundle: true,
  format: "esm",
  external: ["node:*"]
});

if (bresult.errors.length > 0)
  throw new Error(bresult.errors.toString());

if (bresult.warnings.length > 0)
  throw new Error(bresult.warnings.toString());