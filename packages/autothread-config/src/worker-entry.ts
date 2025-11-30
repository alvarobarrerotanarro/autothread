import Routines from "@routines";
import type { Result, Task, TaskWorkerMessage } from '@alvarobarrerotanarro/autothread-types'

import { isNode, isBrowser } from "./runtime.js"; // Makes Node.JS `Worker` and `parentPort` available to global scope.

declare const listen: ((type: "message" | "error", handler: (d: any) => void) => void);
declare const post: (message: TaskWorkerMessage) => void;


function predicateResult(maybe: unknown): maybe is Result<any> {
  return (
    typeof maybe == "object" &&
    maybe != null &&
    typeof (maybe as any)["ok"] == "boolean" &&
    (
      (maybe as any)["ok"] &&
      typeof (maybe as any)["value"] != "undefined"
      ||
      !(maybe as any)["ok"] &&
      typeof (maybe as any)["error"] == "string"
    )
  );
}

export class RoutineException extends Error {
  name = "RoutineException"
}

if (
  isBrowser &&
  (!(<any>self).Worker || !(<any>self).listen || !(<any>self).post) ||
  isNode &&
  (!(<any>global).Worker || !(<any>global).listen || !(<any>global).post)
) {
  throw new TypeError("Workers API was not found at global scope.");
}

async function entry() {

  async function onmessage(task: Task) {
    const Routine = Routines[task.command.routine];
    if (typeof Routine != "function")
      throw new TypeError("Unknown routine name.");

    let routineResult = null
    try {
      routineResult = await Routine(task.command.data);
    } catch (error: any) {
      throw new RoutineException(error instanceof Error ? `${error.message}\n${error.stack}` : String(error));
    }

    if (!predicateResult(routineResult))
      throw new TypeError("Worker routines should return result-like data types.");

    post({ result: routineResult, task });
  }

  listen("message", onmessage);
}

entry().catch(error => { throw new Error(error.message || String(error)) });