import type { Command, FinalizedTask, Result, Serialized, Task, TaskWorkerMessage } from "@alvarobarrerotanarro/autothread-types"

import { RuntimeWorker } from "./runtime.js"
import { TaskContainer } from "./task-utils.js"
import { predicateTWorkerMessage } from "./predicates.js";


export type TaskWorkerHooks = {
  ontaskdone(message: TaskWorkerMessage): void;
  ontaskdispatched(task: Task): void;
}


type TaskWorkerOptions = {
  entry: string;
  tcontainer: TaskContainer;
  hooks: Partial<TaskWorkerHooks>;
}

/**
 * Used to dispatch tasks. Each worker has a workload based on the number of tasks, ignoring the computation effort each of which may entail.
 */
export class TaskWorker {
  private readonly tcontainer: TaskContainer
  private readonly hooks: Partial<TaskWorkerHooks>
  private readonly rworker: RuntimeWorker;

  constructor(options: TaskWorkerOptions) {
    if (!options || typeof options != "object")
      throw TypeError("TaskWorker");

    this.tcontainer = options?.tcontainer || new TaskContainer();
    this.hooks = options?.hooks || {};
    this.rworker = new RuntimeWorker(options.entry);

    this.rworker.listen("message", (data: TaskWorkerMessage) => {
      if (!predicateTWorkerMessage(data)) {
        throw new TypeError("TaskWorker.listen.onincomingevent");
      }

      try {
        const fresult = this.tcontainer.finalize(data.task, data.result);
        if (!fresult.ok)
          throw { message: `Task result reception error${fresult.error ? `: ${fresult.error}` : "."}` };

        if (this.hooks.ontaskdone)
          this.hooks.ontaskdone(data);
      } catch (error: any) {
        const fresult = this.tcontainer.finalize(data.task, { ok: false, error: error.message || String(error) });
        if (!fresult.ok)
          throw new Error(fresult.error || "Task result reception error.");
      }
    })
  }

  dispatch<T extends Serialized>(cmd: Command): Result<PromiseLike<FinalizedTask<T>>> {
    const maybeRegistry = this.tcontainer.register<T>(cmd);
    if (!maybeRegistry.ok)
      return maybeRegistry;
    const { payload: task } = maybeRegistry.value;
    const { pending: promise } = maybeRegistry.value;

    try {
      this.rworker.post(task);

      if (this.hooks.ontaskdispatched)
        this.hooks.ontaskdispatched(task);

      return { ok: true, value: promise };
    } catch (error: any) {
      const fresult = this.tcontainer.finalize(task, { ok: false, error: `Dispatch error: ${error.message || String(error)}` });
      if (!fresult.ok)
        throw new Error(fresult.error || "Dispatch error."); // unhandleable error

      return { ok: false, error: error.message || String(error) }
    }

  }

  terminate() {
    this.rworker.terminate();
  }
}