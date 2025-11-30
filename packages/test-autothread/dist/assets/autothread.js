// src/routines.ts
var usersURL = "https://dummyjson.com/users";
function fibonacci(num) {
  if (num < 2)
    return num;
  return fibonacci(num - 1) + fibonacci(num - 2);
}
var routines_default = {
  // Healthcheck
  greet() {
    return { ok: true, value: "Hello World !" };
  },
  // Heavy work
  fibonacci(num) {
    if (num > 50) {
      return { ok: false, error: "Too heavy calculus." };
    }
    return { ok: true, value: fibonacci(num) };
  },
  // Event loop microtask saturation. 
  async countPeopleEyeColor(color) {
    try {
      const req = await fetch(usersURL);
      const data = await req.json();
      let counter = 0;
      for (let user of data.users) {
        if (user.eyeColor.toLowerCase() == color)
          counter++;
      }
      return { ok: true, value: counter };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
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
if (isNode) {
  const { Worker, parentPort } = await import("node:worker_threads");
  global.Worker = Worker;
  global.listen = parentPort?.addListener ? (type, handler) => parentPort.addListener(type, handler) : void 0;
  global.post = parentPort?.postMessage ? (message) => parentPort.postMessage(message) : void 0;
  global.hardwareConcurrency = hardwareConcurrency;
} else {
  self.listen = (type, handler) => self.addEventListener(type, (e) => handler(type == "message" ? e.data : type == "error" ? e.error : null));
  self.post = (message) => self.postMessage(message);
  self.hardwareConcurrency = hardwareConcurrency;
}

// ../autothread-config/src/worker-entry.ts
function predicateResult(maybe) {
  return typeof maybe == "object" && maybe != null && typeof maybe["ok"] == "boolean" && (maybe["ok"] && typeof maybe["value"] != "undefined" || !maybe["ok"] && typeof maybe["error"] == "string");
}
var RoutineException = class extends Error {
  name = "RoutineException";
};
if (isBrowser && (!self.Worker || !self.listen || !self.post) || isNode && (!global.Worker || !global.listen || !global.post)) {
  throw new TypeError("Workers API was not found at global scope.");
}
async function entry() {
  async function onmessage(task) {
    const Routine = routines_default[task.command.routine];
    if (typeof Routine != "function")
      throw new TypeError("Unknown routine name.");
    let routineResult = null;
    try {
      routineResult = await Routine(task.command.data);
    } catch (error) {
      throw new RoutineException(error instanceof Error ? `${error.message}
${error.stack}` : String(error));
    }
    if (!predicateResult(routineResult))
      throw new TypeError("Worker routines should return result-like data types.");
    post({ result: routineResult, task });
  }
  listen("message", onmessage);
}
entry().catch((error) => {
  throw new Error(error.message || String(error));
});
export {
  RoutineException
};
