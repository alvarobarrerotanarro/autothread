export class UnsupportedRuntime extends Error {
    name = "UnsupportedRuntime";
    constructor() {
        super(`Runtime environment is not supported. Supported environments are ${["Node.JS", "Chromium", "Firefox", "Safari"].join(" | ")}`);
    }
}
export const isNode = typeof global == "object" &&
    typeof process == "object" &&
    typeof process.versions == "object" &&
    typeof process.versions.node == "string"
    ? true : false;
export const isBrowserMain = !isNode && typeof window == "object" && typeof window.document == "object";
export const isBrowserWorker = !isNode &&
    typeof window == "undefined" &&
    typeof importScripts == "function";
export const isBrowser = isBrowserMain || isBrowserWorker;
if (!isNode && !isBrowser)
    throw new UnsupportedRuntime();
/**
 * The number of logic processors available for this thread (web worker | worker thread | main thread)
 */
export const hardwareConcurrency = await (async function () {
    if (isNode) {
        const { availableParallelism } = await import("node:os");
        return availableParallelism();
    }
    else { // isBrowser
        return navigator.hardwareConcurrency;
    }
})();
/**
 * Makes Node.JS environments see the Worker interface. Worker main thread and worker threads.
 */
if (isNode) {
    // worker
    const { Worker, parentPort } = await import("node:worker_threads");
    global.Worker = Worker;
    global.listen = parentPort?.addListener ? (type, handler) => parentPort.addListener(type, handler) : undefined;
    global.post = parentPort?.postMessage ? (message) => parentPort.postMessage(message) : undefined;
    global.hardwareConcurrency = hardwareConcurrency;
}
else { // browser
    // worker
    self.listen = (type, handler) => self.addEventListener(type, (e) => handler(type == "message" ? e.data : type == "error" ? e.error : null));
    self.post = (message) => self.postMessage(message);
    self.hardwareConcurrency = hardwareConcurrency;
}
//# sourceMappingURL=runtime.js.map