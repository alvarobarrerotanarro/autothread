// src/routines.ts
var routines_default = {
  greet() {
    return "Hello World !";
  },
  fibonacci(num) {
    if (num - 2 < 0)
      return num;
    return this.fibonacci(num - 1) + this.fibonacci(num - 2);
  }
};

// ../autothread-config/src/runtime.ts
var UnsupportedRuntime = class extends Error {
  name = "UnsupportedRuntime";
  constructor() {
    super(`Runtime environment is not supported. Supported environments are ${["Node.JS", "Chromium", "Firefox", "Safari"].join(" | ")}`);
  }
};
var isNode = typeof global == "object" && typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" ? true : false;
var isBrowserMain = !isNode && typeof window == "object" && typeof window.document == "object";
var isBrowserWorker = !isNode && typeof window == "undefined" && typeof importScripts == "function";
var isBrowser = isBrowserMain || isBrowserWorker;
if (!isNode && !isBrowser)
  throw new UnsupportedRuntime();
var hardwareConcurrency = await (async function() {
  if (isNode) {
    const { availableParallelism } = await import("node:os");
    return availableParallelism();
  } else {
    return navigator.hardwareConcurrency;
  }
})();

// ../autothread-config/src/worker-entry.ts
if (isBrowser && (!self.Worker || !self.listen || !self.post) || isNode && (!global.Worker || !global.listen || !global.post)) {
  throw new TypeError("Workers API was not found at global scope.");
}
async function entry() {
  function onmessage(task) {
    const Routine = routines_default[task.command.routine];
    if (typeof Routine != "function")
      throw new TypeError("Unknown routine name.");
    const routineResult = Routine(task.command.data);
    const workerMessage = {
      result: routineResult,
      task
    };
    post(workerMessage);
  }
  listen("message", onmessage);
}
entry().catch((error) => {
  throw new Error(error.message || String(error));
});
