import { dirname, join } from "node:path"
import { readFileSync } from "node:fs"
import { config } from "@alvarobarrerotanarro/autothread-config"


const pkgRoot = dirname(import.meta.dirname);
const conf = join(pkgRoot, "src", "routines.ts");
const output = join(pkgRoot, "dist", "worker-entry.js");

await config(conf, output)

const file = readFileSync(output).toString();
console.log(file);