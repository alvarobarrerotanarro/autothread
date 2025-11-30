import type { Command, Result, Task, TaskWorkerMessage } from "@alvarobarrerotanarro/autothread-types"

export function predicateResult(maybe: unknown): maybe is Result<any> {
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

export function predicateCommand(maybe: unknown): maybe is Command {
  return (
    typeof maybe == "object" &&
    typeof maybe != null &&
    typeof (maybe as any)["routine"] == "string" &&
    typeof (maybe as any)["data"] != "undefined"
  );
}

export function predicateTask(maybe: unknown): maybe is Task {
  return (
    typeof maybe == "object" &&
    maybe != null &&
    typeof (maybe as any)["id"] == "number" &&
    predicateCommand((maybe as any)["command"])
  );
}

export function predicateTWorkerMessage(maybe: unknown): maybe is TaskWorkerMessage {
  return (
    typeof maybe == "object" &&
    maybe != null &&
    predicateResult((maybe as any)["result"]) &&
    predicateTask((maybe as any)["task"])
  );
}