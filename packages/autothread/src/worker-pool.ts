import type { FinalizedTask, Serialized, DispatchRequest } from "@alvarobarrerotanarro/autothread-types"
import { hardwareConcurrency } from "./runtime.js";
import { TaskWorker, type TaskWorkerHooks } from "./tworker.js";
import { TaskContainer } from "./task-utils.js";

/**
 * Math.
 */

const Equations = {
  sublinearExponential(params: { k: number; hc: number; cw: number }) {
    const { k, hc, cw } = params;
    return k * hc * (1 - (1 / Math.exp(hc / cw)));
  }
}

/**
 * Exceptions.
 */

export class UnregisteredTaskWorkerError extends TypeError {
  name = "UnregisteredTaskWorkerError";
  constructor(tworkerID: number) {
    super(`id = '${tworkerID}'`);
  }
};

export class WorkerPoolDispatchError extends Error {
  name = "WorkerPoolDispatchError";
}


export type DispatchRegistration<T extends Serialized> = {
  registration: Promise<number>
  pendingTask: PromiseLike<FinalizedTask<T>>
}


type WorkerPoolPreferences = {
  /**
   * Optimal number of tasks per worker.
   */
  optimalTasks(params: { hc: number; cw: number }): number;

  /**
   * Maximum number of workers within the pool.
   * @hint Using a pool size over `hardwareConcurrency` may be unefficient.
   */
  maxPoolSize(params: { hc: number }): number;

  /**
   * 
   * @hint Very small values for `hc` may be unefficient if the pool increments and decrements in size very frequently.
   */
  minPoolSize(params: { hc: number }): number;

  /**
   * Logs the chosen workers by the pool.
   */
  inspect: boolean;
};

type WorkerPoolOptions = {
  /**
   * Task workers entry file.
   */
  entry: string;

  /**
   * Common task container for all workers.
   */
  tcontainer?: TaskContainer;

  /**
   * User defined hooks for each worker within the pool.
   */
  tworkerHooks?: Partial<TaskWorkerHooks>
};

/**
 * Handles multiple workers and dispatch tasks to them (such as transcripts). Each worker is initially configured with the model file.
 */
export class WorkerPool {
  private static idGenerator = 0;

  private readonly registries = new Map<number, { tworker: TaskWorker, workload: number }>();
  private readonly entry: string;
  private readonly tcontainer: TaskContainer;
  private readonly tworkerHooks: Partial<TaskWorkerHooks>;
  private readonly preferences: WorkerPoolPreferences;

  constructor(options: WorkerPoolOptions, preferences?: Partial<WorkerPoolPreferences>) {
    this.entry = options.entry;
    this.tcontainer = options && typeof options == "object" && typeof options.tcontainer == "object" ?
      options.tcontainer :
      new TaskContainer({}, {
        maxContainerSize: Math.floor(Equations.sublinearExponential({ k: 1, hc: hardwareConcurrency, cw: hardwareConcurrency }) * hardwareConcurrency)
      });
    this.tworkerHooks = options && typeof options == "object" && typeof options.tworkerHooks == "object" ? options.tworkerHooks : {};
    this.preferences = {
      optimalTasks: preferences && typeof preferences == "object" && typeof preferences.optimalTasks == "function" ? preferences.optimalTasks : ({ hc, cw }: { hc: number; cw: number }) => {
        const e = Equations.sublinearExponential({
          k: 4 / 5,
          hc,
          cw
        });
        return Math.floor(e);
      },

      maxPoolSize: preferences && typeof preferences == "object" && typeof preferences.maxPoolSize == "function" ? preferences.maxPoolSize : ({ hc }) => { return hc; },

      minPoolSize: preferences && typeof preferences == "object" && typeof preferences.minPoolSize == "function" ? preferences.minPoolSize : ({ hc }) => { return Math.floor(hc * 0.3); },

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
  private static async register(pool: WorkerPool) {
    if (pool.registries.size > pool.preferences.maxPoolSize({ hc: hardwareConcurrency }))
      throw new TypeError("WorkerPool.register");

    const tworkerID = WorkerPool.idGenerator++;
    const tworker = new TaskWorker({
      entry: pool.entry,
      tcontainer: pool.tcontainer,
      hooks: {

        ontaskdispatched(task) {
          const registry = pool.registries.get(tworkerID);
          if (!registry)
            throw new UnregisteredTaskWorkerError(tworkerID);
          registry.workload++;

          if (pool.preferences.inspect)
            console.log({ logfrom: `WorkerPool tworker ontaskdispatched hook`, tworkerID, optimalTasksPerWorker: pool.preferences.optimalTasks({ hc: hardwareConcurrency, cw: pool.registries.size }), task });

          if (pool.tworkerHooks.ontaskdispatched)
            pool.tworkerHooks.ontaskdispatched(task);
        },

        ontaskdone(message) {
          const registry = pool.registries.get(tworkerID);
          if (!registry)
            throw new UnregisteredTaskWorkerError(tworkerID);
          registry.workload--;

          if (pool.preferences.inspect)
            console.log({ logfrom: `WorkerPool tworker ontaskdone hook`, tworkerID, workerMessage: message });

          // Shrink the worker pool.
          if (
            registry.workload < 1 &&
            pool.registries.size > pool.preferences.minPoolSize({ hc: hardwareConcurrency })
          ) {
            tworker.terminate();
            pool.registries.delete(tworkerID);
          }

          if (pool.tworkerHooks.ontaskdone)
            pool.tworkerHooks.ontaskdone(message);
        },
      }
    });

    pool.registries.set(tworkerID, { tworker, workload: 0 });
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
  private dispatchByID<T extends Serialized>(workerID: number, req: DispatchRequest) {
    const maybeRegistry = this.registries.get(workerID);
    if (!maybeRegistry)
      throw new UnregisteredTaskWorkerError(workerID);
    const attempt = maybeRegistry.tworker.dispatch<T>(req.command());
    if (!attempt.ok)
      throw new WorkerPoolDispatchError(attempt.error);
    return attempt.value;
  }

  /**
   * Dispatch a task to the worker with least workload.
   * @param task The unregistered task to dispatch to the pool.
   */
  dispatchGreedy<T extends Serialized>(req: DispatchRequest): DispatchRegistration<T> {
    let tworkerMeta: { id: number; tworker: TaskWorker, workload: number } | null = null;
    let growthNeeded = true;

    if (this.registries.size > 0) {
      const [least] = Array.from(this.registries).sort(([, a], [, b]) => a.workload - b.workload).slice(0, 2);
      tworkerMeta = { ...least![1], id: least![0] };
      if (tworkerMeta.workload < this.preferences.optimalTasks({ hc: hardwareConcurrency, cw: this.registries.size }))
        growthNeeded = false;
    }

    // If grows, pending task has to await until registration is done.
    if (growthNeeded) {
      const registration = WorkerPool.register(this);
      const pendingTask = new Promise<FinalizedTask<T>>(async ontaskresult => {
        const tworkerID = await registration;
        const tworkerRegistry = this.registries.get(tworkerID);
        if (!tworkerRegistry)
          throw new UnregisteredTaskWorkerError(tworkerID);

        const attempt = tworkerRegistry.tworker.dispatch<T>(req.command());
        if (!attempt.ok)
          throw new WorkerPoolDispatchError(attempt.error);
        ontaskresult(attempt.value);
      });

      return { registration, pendingTask };
    }
    // New task worker is needed. 
    else if (tworkerMeta) {
      const registration = new Promise<number>(ontworkerchosen => ontworkerchosen(tworkerMeta.id));
      const pendingTask = new Promise<FinalizedTask<T>>(async ontaskresult => {
        await registration;
        const attempt = tworkerMeta.tworker.dispatch<T>(req.command());
        if (!attempt.ok)
          throw new WorkerPoolDispatchError(attempt.error);
        ontaskresult(attempt.value);
      });

      return { registration, pendingTask };
    } else {
      throw new TypeError("WorkerPool.dispatchGreedy");
    }
  }
}