import { dirname, join } from "node:path"
import { config } from "@alvarobarrerotanarro/autothread-config"

const pkgRoot = dirname(import.meta.dirname);
const routines = join(pkgRoot, "src", "routines.ts");

await config(routines, "./dist/assets/autothread.js");