import { predicateResult, Result } from "@panprogramadorgh/types"
import { RuntimeWorker } from "../runtime.js"
import { Task, TaskContainer, FinalizedTask, type UnregisteredTask } from "./task-utils.js";
import { type Serializable } from "./command.js";


type TaskWorkerMessage = {
  task: Task;
  result: Result<any>;
};

// FIXME: Make hooks safe [X]
// FIXME: Remove asynchrony from hooks [X]
// FIXME: Unregister failure tasks [X]

export type TaskWorkerHooks = {
  ontaskdone(message: TaskWorkerMessage): void;
  ontaskdispatched(task: Task): void;
}


type TaskWorkerOptions = {
  tcontainer: TaskContainer;
  hooks: Partial<TaskWorkerHooks>;
}

/**
 * Used to dispatch tasks. Each worker has a workload based on the number of tasks, ignoring the computation effort each of which may entail.
 */
export class TaskWorker {
  private static readonly entry = new URL(import.meta.resolve("./tworker-entry.js", import.meta.dirname))

  private readonly tcontainer: TaskContainer
  private readonly hooks: Partial<TaskWorkerHooks>
  private readonly rworker: RuntimeWorker;

  constructor(options: TaskWorkerOptions) {
    if (!options || typeof options != "object")
      throw TypeError("TaskWorker");

    this.tcontainer = options?.tcontainer || new TaskContainer();
    this.hooks = options?.hooks || {};
    this.rworker = new RuntimeWorker(TaskWorker.entry);

    this.rworker.listen("message", (data: { task: Task, result: Result<Serializable> }) => {
      if (
        !data || typeof data != "object" ||
        !Task.predicate(data.task) ||
        !predicateResult(data.result)
      ) {
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

  dispatch<T extends Serializable>(utask: UnregisteredTask): Result<PromiseLike<FinalizedTask<T>>> {
    const maybeRegistry = this.tcontainer.register<T>(utask);
    if (!maybeRegistry.ok)
      return maybeRegistry;
    const { payload: task } = maybeRegistry.value;
    const { pending: promise } = maybeRegistry.value;


    // Abort is a mocked task.
    if (task.command.type == "abort") {

      try {
        this.rworker.terminate();
        const tresult = this.tcontainer.finalize(task, { ok: true, value: "abort" });
        if (!tresult.ok)
          throw { message: tresult.error }

        return { ok: true, value: promise };
      } catch (error: any) {
        return { ok: false, error: error.message || String(error) };
      }

    }

    // Regular tasks.
    else {

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
  }

  terminate() {
    this.rworker.terminate();
  }
}