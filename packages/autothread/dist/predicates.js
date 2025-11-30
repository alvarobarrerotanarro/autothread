export function predicateResult(maybe) {
    return (typeof maybe == "object" &&
        maybe != null &&
        typeof maybe["ok"] == "boolean" &&
        (maybe["ok"] &&
            typeof maybe["value"] != "undefined"
            ||
                !maybe["ok"] &&
                    typeof maybe["error"] == "string"));
}
export function predicateCommand(maybe) {
    return (typeof maybe == "object" &&
        typeof maybe != null &&
        typeof maybe["routine"] == "string" &&
        typeof maybe["data"] != "undefined");
}
export function predicateTask(maybe) {
    return (typeof maybe == "object" &&
        maybe != null &&
        typeof maybe["id"] == "number" &&
        predicateCommand(maybe["command"]));
}
export function predicateTWorkerMessage(maybe) {
    return (typeof maybe == "object" &&
        maybe != null &&
        predicateResult(maybe["result"]) &&
        predicateTask(maybe["task"]));
}
//# sourceMappingURL=predicates.js.map