import type { PathLike } from "node:fs";
import { dirname, join } from "node:path"
import { build } from "esbuild"
import alias from "esbuild-plugin-alias"

const pkgRoot = dirname(import.meta.dirname);

/**
 * Builds an autothread worker entry script along with routines.
 * @param outfile The output file path.
 */
export async function config(conf: PathLike, outfile: PathLike) {
  const bresult = await build({
    entryPoints: [join(pkgRoot, "src", "worker-entry.ts")],
    outfile: outfile.toString(),
    bundle: true,
    plugins: [
      alias({
        "@routines": conf.toString()
      })
    ],
    external: ["node:*"],
    format: "esm"
  });

  if (bresult.errors.length) {
    throw new Error(bresult.errors.toString());
  } else if (bresult.warnings.length) {
    console.warn(bresult.warnings.toString());
  }
}