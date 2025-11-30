import Routines from "@routines";
import { isNode, isBrowser } from "./runtime.js"; // Makes Node.JS `Worker` and `parentPort` available to global scope.
function predicateResult(maybe) {
    return (typeof maybe == "object" &&
        maybe != null &&
        typeof maybe["ok"] == "boolean" &&
        (maybe["ok"] &&
            typeof maybe["value"] != "undefined"
            ||
                !maybe["ok"] &&
                    typeof maybe["error"] == "string"));
}
export class RoutineException extends Error {
    name = "RoutineException";
}
if (isBrowser &&
    (!self.Worker || !self.listen || !self.post) ||
    isNode &&
        (!global.Worker || !global.listen || !global.post)) {
    throw new TypeError("Workers API was not found at global scope.");
}
async function entry() {
    async function onmessage(task) {
        const Routine = Routines[task.command.routine];
        if (typeof Routine != "function")
            throw new TypeError("Unknown routine name.");
        let routineResult = null;
        try {
            routineResult = await Routine(task.command.data);
        }
        catch (error) {
            throw new RoutineException(error instanceof Error ? `${error.message}\n${error.stack}` : String(error));
        }
        if (!predicateResult(routineResult))
            throw new TypeError("Worker routines should return result-like data types.");
        post({ result: routineResult, task });
    }
    listen("message", onmessage);
}
entry().catch(error => { throw new Error(error.message || String(error)); });
//# sourceMappingURL=worker-entry.js.map