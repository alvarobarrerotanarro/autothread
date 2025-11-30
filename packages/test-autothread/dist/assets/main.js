// ../autothread/dist/runtime.js
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
  const { Worker: Worker2, parentPort } = await import("node:worker_threads");
  global.Worker = Worker2;
  global.listen = parentPort?.addListener ? (type, handler) => parentPort.addListener(type, handler) : void 0;
  global.post = parentPort?.postMessage ? (message) => parentPort.postMessage(message) : void 0;
  global.hardwareConcurrency = hardwareConcurrency;
} else {
  self.listen = (type, handler) => self.addEventListener(type, (e) => handler(type == "message" ? e.data : type == "error" ? e.error : null));
  self.post = (message) => self.postMessage(message);
  self.hardwareConcurrency = hardwareConcurrency;
}
var RuntimeWorker = class {
  controller;
  constructor(entry) {
    let options = isBrowser ? { type: "module" } : void 0;
    this.controller = new Worker(entry, options);
  }
  listen(type, onincomingevent) {
    if (!["message", "error"].includes(type))
      throw new TypeError("RuntimeWorker.listen");
    if (isNode) {
      this.controller.addListener(type, (e) => onincomingevent(e));
    } else if (isBrowser) {
      this.controller.addEventListener(type, (e) => {
        if (type == "message")
          onincomingevent(e.data);
        else
          onincomingevent(e.error);
      });
    }
  }
  post(message) {
    this.controller.postMessage(message);
  }
  terminate() {
    this.controller.terminate();
  }
};

// ../autothread/dist/predicates.js
function predicateResult(maybe) {
  return typeof maybe == "object" && maybe != null && typeof maybe["ok"] == "boolean" && (maybe["ok"] && typeof maybe["value"] != "undefined" || !maybe["ok"] && typeof maybe["error"] == "string");
}
function predicateCommand(maybe) {
  return typeof maybe == "object" && typeof maybe != null && typeof maybe["routine"] == "string" && typeof maybe["data"] != "undefined";
}
function predicateTask(maybe) {
  return typeof maybe == "object" && maybe != null && typeof maybe["id"] == "number" && predicateCommand(maybe["command"]);
}
function predicateTWorkerMessage(maybe) {
  return typeof maybe == "object" && maybe != null && predicateResult(maybe["result"]) && predicateTask(maybe["task"]);
}

// ../autothread/dist/task-utils.js
var UnregisteredTaskError = class extends TypeError {
  name = "UnregisteredTaskError";
  constructor(taskID) {
    super(`id = '${taskID}'`);
  }
};
var PendingTask = class {
  promise;
  resolve;
  reject;
  timestamp = performance.now();
  constructor() {
    let resolve = null;
    let reject = null;
    this.promise = new Promise((r, j) => {
      resolve = r;
      reject = j;
    });
    this.resolve = resolve;
    this.reject = reject;
  }
  done(result) {
    result.ok ? this.resolve(result.value) : this.reject(result.error);
  }
  then(onfulfilled, onrejected) {
    return this.promise.then((value) => {
      const tresult = { value, overhead: performance.now() - this.timestamp };
      if (typeof onfulfilled == "function")
        return onfulfilled(tresult);
      return tresult;
    }, onrejected);
  }
};
var TaskContainer = class _TaskContainer {
  static idGenerator = 0;
  registries = /* @__PURE__ */ new Map();
  hooks;
  preferences;
  constructor(hooks = {}, preferences = {}) {
    if (!hooks || typeof hooks != "object" || !preferences || typeof preferences != "object") {
      throw new TypeError("TaskContainer");
    }
    const validatedPreferences = {
      maxContainerSize: preferences.maxContainerSize || Math.floor(hardwareConcurrency ** 1.1) + (hardwareConcurrency * 5 - 1)
    };
    this.hooks = hooks;
    this.preferences = validatedPreferences;
  }
  register(cmd) {
    if (!predicateCommand(cmd))
      throw new TypeError("TaskContainer.register");
    if (this.registries.size > this.preferences.maxContainerSize)
      return { ok: false, error: `Max container size reached: '${this.preferences.maxContainerSize}'` };
    const task = { command: cmd, id: _TaskContainer.idGenerator++ };
    const registry = { payload: task, pending: new PendingTask() };
    this.registries.set(task.id, registry);
    try {
      if (this.hooks.onregistered)
        this.hooks.onregistered(task);
      return { ok: true, value: registry };
    } catch (error) {
      this.registries.delete(task.id);
      return { ok: false, error: `Hook error 'onregistered': ${error.message || String(error)}` };
    }
  }
  finalize(task, result) {
    const registry = this.registries.get(task.id);
    if (!registry) {
      throw new UnregisteredTaskError(task.id);
    }
    registry.pending.done(result);
    this.registries.delete(task.id);
    try {
      if (this.hooks.onfinalized)
        this.hooks.onfinalized(registry, result);
      return { ok: true, value: null };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  }
};

// ../autothread/dist/tworker.js
var TaskWorker = class {
  tcontainer;
  hooks;
  rworker;
  constructor(options) {
    if (!options || typeof options != "object")
      throw TypeError("TaskWorker");
    this.tcontainer = options?.tcontainer || new TaskContainer();
    this.hooks = options?.hooks || {};
    this.rworker = new RuntimeWorker(options.entry);
    this.rworker.listen("message", (data) => {
      if (!predicateTWorkerMessage(data)) {
        throw new TypeError("TaskWorker.listen.onincomingevent");
      }
      try {
        const fresult = this.tcontainer.finalize(data.task, data.result);
        if (!fresult.ok)
          throw { message: `Task result reception error${fresult.error ? `: ${fresult.error}` : "."}` };
        if (this.hooks.ontaskdone)
          this.hooks.ontaskdone(data);
      } catch (error) {
        const fresult = this.tcontainer.finalize(data.task, { ok: false, error: error.message || String(error) });
        if (!fresult.ok)
          throw new Error(fresult.error || "Task result reception error.");
      }
    });
  }
  dispatch(cmd) {
    const maybeRegistry = this.tcontainer.register(cmd);
    if (!maybeRegistry.ok)
      return maybeRegistry;
    const { payload: task } = maybeRegistry.value;
    const { pending: promise } = maybeRegistry.value;
    try {
      this.rworker.post(task);
      if (this.hooks.ontaskdispatched)
        this.hooks.ontaskdispatched(task);
      return { ok: true, value: promise };
    } catch (error) {
      const fresult = this.tcontainer.finalize(task, { ok: false, error: `Dispatch error: ${error.message || String(error)}` });
      if (!fresult.ok)
        throw new Error(fresult.error || "Dispatch error.");
      return { ok: false, error: error.message || String(error) };
    }
  }
  terminate() {
    this.rworker.terminate();
  }
};

// ../autothread/dist/worker-pool.js
var Equations = {
  sublinearExponential(params) {
    const { k, hc, cw } = params;
    return k * hc * (1 - 1 / Math.exp(hc / cw));
  }
};
var UnregisteredTaskWorkerError = class extends TypeError {
  name = "UnregisteredTaskWorkerError";
  constructor(tworkerID) {
    super(`id = '${tworkerID}'`);
  }
};
var WorkerPoolDispatchError = class extends Error {
  name = "WorkerPoolDispatchError";
};
var WorkerPool = class _WorkerPool {
  static idGenerator = 0;
  registries = /* @__PURE__ */ new Map();
  entry;
  tcontainer;
  tworkerHooks;
  preferences;
  constructor(options, preferences) {
    this.entry = options.entry;
    this.tcontainer = options && typeof options == "object" && typeof options.tcontainer == "object" ? options.tcontainer : new TaskContainer({}, {
      maxContainerSize: Math.floor(Equations.sublinearExponential({ k: 1, hc: hardwareConcurrency, cw: hardwareConcurrency }) * hardwareConcurrency)
    });
    this.tworkerHooks = options && typeof options == "object" && typeof options.tworkerHooks == "object" ? options.tworkerHooks : {};
    this.preferences = {
      optimalTasks: preferences && typeof preferences == "object" && typeof preferences.optimalTasks == "function" ? preferences.optimalTasks : ({ hc, cw }) => {
        const e = Equations.sublinearExponential({
          k: 4 / 5,
          hc,
          cw
        });
        return Math.floor(e);
      },
      maxPoolSize: preferences && typeof preferences == "object" && typeof preferences.maxPoolSize == "function" ? preferences.maxPoolSize : ({ hc }) => {
        return hc;
      },
      minPoolSize: preferences && typeof preferences == "object" && typeof preferences.minPoolSize == "function" ? preferences.minPoolSize : ({ hc }) => {
        return Math.floor(hc * 0.3);
      },
      inspect: preferences && typeof preferences == "object" && typeof preferences.inspect == "boolean" ? preferences.inspect : false
    };
  }
  get parallelismDemand() {
    return this.registries.size;
  }
  /**
   * Internal helper used to register tasks.
   * @param pool Any WorkerPool.
   * @returns The designated worker ID.
   */
  static async register(pool2) {
    if (pool2.registries.size > pool2.preferences.maxPoolSize({ hc: hardwareConcurrency }))
      throw new TypeError("WorkerPool.register");
    const tworkerID = _WorkerPool.idGenerator++;
    const tworker = new TaskWorker({
      entry: pool2.entry,
      tcontainer: pool2.tcontainer,
      hooks: {
        ontaskdispatched(task) {
          const registry = pool2.registries.get(tworkerID);
          if (!registry)
            throw new UnregisteredTaskWorkerError(tworkerID);
          registry.workload++;
          if (pool2.preferences.inspect)
            console.log({ logfrom: `WorkerPool tworker ontaskdispatched hook`, tworkerID, optimalTasksPerWorker: pool2.preferences.optimalTasks({ hc: hardwareConcurrency, cw: pool2.registries.size }), task });
          if (pool2.tworkerHooks.ontaskdispatched)
            pool2.tworkerHooks.ontaskdispatched(task);
        },
        ontaskdone(message) {
          const registry = pool2.registries.get(tworkerID);
          if (!registry)
            throw new UnregisteredTaskWorkerError(tworkerID);
          registry.workload--;
          if (pool2.preferences.inspect)
            console.log({ logfrom: `WorkerPool tworker ontaskdone hook`, tworkerID, workerMessage: message });
          if (registry.workload < 1 && pool2.registries.size > pool2.preferences.minPoolSize({ hc: hardwareConcurrency })) {
            tworker.terminate();
            pool2.registries.delete(tworkerID);
          }
          if (pool2.tworkerHooks.ontaskdone)
            pool2.tworkerHooks.ontaskdone(message);
        }
      }
    });
    pool2.registries.set(tworkerID, { tworker, workload: 0 });
    return tworkerID;
  }
  async abortAll() {
    for (const [_, registry] of this.registries) {
      registry.tworker.terminate();
    }
  }
  /**
   * @param task The unregistered task to dispatch to the pool.
   */
  dispatchByID(workerID, req) {
    const maybeRegistry = this.registries.get(workerID);
    if (!maybeRegistry)
      throw new UnregisteredTaskWorkerError(workerID);
    const attempt = maybeRegistry.tworker.dispatch(req.command());
    if (!attempt.ok)
      throw new WorkerPoolDispatchError(attempt.error);
    return attempt.value;
  }
  /**
   * Dispatch a task to the worker with least workload.
   * @param task The unregistered task to dispatch to the pool.
   */
  dispatchGreedy(req) {
    let tworkerMeta = null;
    let growthNeeded = true;
    if (this.registries.size > 0) {
      const [least] = Array.from(this.registries).sort(([, a], [, b]) => a.workload - b.workload).slice(0, 2);
      tworkerMeta = { ...least[1], id: least[0] };
      if (tworkerMeta.workload < this.preferences.optimalTasks({ hc: hardwareConcurrency, cw: this.registries.size }))
        growthNeeded = false;
    }
    if (growthNeeded) {
      const registration = _WorkerPool.register(this);
      const pendingTask = new Promise(async (ontaskresult) => {
        const tworkerID = await registration;
        const tworkerRegistry = this.registries.get(tworkerID);
        if (!tworkerRegistry)
          throw new UnregisteredTaskWorkerError(tworkerID);
        const attempt = tworkerRegistry.tworker.dispatch(req.command());
        if (!attempt.ok)
          throw new WorkerPoolDispatchError(attempt.error);
        ontaskresult(attempt.value);
      });
      return { registration, pendingTask };
    } else if (tworkerMeta) {
      const registration = new Promise((ontworkerchosen) => ontworkerchosen(tworkerMeta.id));
      const pendingTask = new Promise(async (ontaskresult) => {
        await registration;
        const attempt = tworkerMeta.tworker.dispatch(req.command());
        if (!attempt.ok)
          throw new WorkerPoolDispatchError(attempt.error);
        ontaskresult(attempt.value);
      });
      return { registration, pendingTask };
    } else {
      throw new TypeError("WorkerPool.dispatchGreedy");
    }
  }
};

// src/assets/main.ts
var Void = class {
  constructor(routine) {
    this.routine = routine;
  }
  command() {
    return {
      routine: this.routine,
      data: null
    };
  }
};
var Fibonacci = class {
  constructor(num) {
    this.num = num;
  }
  command() {
    return {
      routine: "fibonacci",
      data: this.num
    };
  }
};
var pool = new WorkerPool({ entry: "./js/autothread.js" }, {
  optimalTasks() {
    return 2;
  },
  minPoolSize: () => 0
});
var tasks = [];
async function handleClick() {
  const payload = new Fibonacci(40);
  {
    const task = pool.dispatchGreedy(new Void("greet"));
    await task.registration;
    tasks.push(task.pendingTask);
  }
  for (let i = 0; i < 10; i++) {
    const task = pool.dispatchGreedy(payload);
    await task.registration;
    tasks.push(task.pendingTask);
  }
  ["green", "brown", "blue"].forEach(async (color) => {
    const task = pool.dispatchGreedy({
      command() {
        return {
          routine: "countPeopleEyeColor",
          data: color
        };
      }
    });
    await task.registration;
    tasks.push(task.pendingTask);
  });
  for (let task of tasks) {
    console.log(await task);
  }
}
document.querySelector("#btn")?.addEventListener("click", handleClick);
