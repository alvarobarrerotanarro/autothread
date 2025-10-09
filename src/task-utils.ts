import { Result, predicateResult } from "@panprogramadorgh/types"
import { Command, Serializable, predicateCommand } from "./command.js"
import { hardwareConcurrency } from "../runtime.js";


export type UnregisteredTask = {
  command: Command;
}

export type Task = {
  id: number;
} & UnregisteredTask;

export type FinalizedTask<T extends Serializable> = {
  value: T;
  overhead: number;
}

export const Task = {
  make(command: Command): UnregisteredTask {
    return { command };
  },

  predicate(maybeUtask: any): maybeUtask is UnregisteredTask {
    if (maybeUtask == null || typeof maybeUtask != "object")
      return false;
    else if (!predicateCommand(maybeUtask["command"]))
      return false;
    return true;
  }
}


export class PendingTask<T extends Serializable = Serializable> {
  private readonly promise: Promise<T>;
  private readonly resolve: (value: T) => void;
  private readonly reject: (reason: any) => void;
  private readonly timestamp = performance.now();

  constructor() {
    let resolve: ((value: T) => void) | null = null;
    let reject: ((reason: any) => void) | null = null;
    this.promise = new Promise<T>((r, j) => {
      resolve = r;
      reject = j;
    });
    this.resolve = resolve!;
    this.reject = reject!;
  }

  done(result: Result<T, Serializable>) {
    result.ok ? this.resolve(result.value) : this.reject(result.error);
  }

  then(onfulfilled?: ((value: FinalizedTask<T>) => any | PromiseLike<any>) | null | undefined, onrejected?: ((reason: any) => PromiseLike<never>) | null | undefined) {
    return this.promise.then((value) => {
      const tresult = { value, overhead: performance.now() - this.timestamp };
      if (typeof onfulfilled == "function")
        return onfulfilled(tresult)
      return tresult;
    }, onrejected);
  }
}

export class UnregisteredTaskError extends TypeError {
  name = "UnregisteredTaskError";
  constructor(taskID: number) {
    super(`id = '${taskID}'`);
  }
};


type TaskContainerHooks = {
  onregistered: (task: Readonly<Task>) => void;
  onfinalized: (registry: Readonly<{ payload: Task, pending: PendingTask }>, result: Readonly<Result<Serializable>>) => void;
}

type TaskContainerPreferences = {
  maxContainerSize: number;
}

/**
 * Pending tasks container.
 */
export class TaskContainer {
  private static idGenerator = 0;

  private readonly registries = new Map<number, { payload: Task, pending: PendingTask }>();
  private readonly hooks: Partial<TaskContainerHooks>
  private readonly preferences: TaskContainerPreferences;

  constructor(
    hooks: Partial<TaskContainerHooks> = {},
    preferences: Partial<TaskContainerPreferences> = {},
  ) {
    if (
      !hooks || typeof hooks != "object" ||
      !preferences || typeof preferences != "object"
    ) {
      throw new TypeError("TaskContainer");
    }
    const validatedPreferences = {
      maxContainerSize: preferences.maxContainerSize ||
        Math.floor(hardwareConcurrency ** 1.10) + (hardwareConcurrency * 5 - 1)
    }

    this.hooks = hooks;
    this.preferences = validatedPreferences;
  }

  register<T extends Serializable>(utask: UnregisteredTask): Result<{ payload: Task, pending: PendingTask<T> }> {
    if (!Task.predicate(utask))
      throw new TypeError("TaskContainer.register");
    if (this.registries.size > this.preferences.maxContainerSize)
      return { ok: false, error: `Max container size reached: '${this.preferences.maxContainerSize}'` }

    const task = { ...utask, id: TaskContainer.idGenerator++ }
    const registry = { payload: task, pending: new PendingTask<T>() }
    this.registries.set(task.id, registry as any);

    try {
      if (this.hooks.onregistered)
        this.hooks.onregistered(task);
      return { ok: true, value: registry };
    } catch (error: any) {
      this.registries.delete(task.id);
      return { ok: false, error: `Hook error 'onregistered': ${error.message || String(error)}` };
    }
  }

  finalize(task: Task, result: Result<Serializable>): Result<null> {
    if (
      !Task.predicate(task) || typeof (task as any)["id"] != "number" ||
      !predicateResult(result)
    )
      throw new TypeError("TaskContainer.finalize");

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
    } catch (error: any) {
      return { ok: false, error: error.message || String(error) };
    }
  }
}

/**
 * Task container hook sets.
 */
export const TaskContainerBuiltInHooks = {
  inspect: {
    onregistered(task: Task) {
      console.log({ logfrom: "TaskContainer onregistered hook", task });
    },
    onfinalized(registry: Readonly<{ payload: Task, pending: PendingTask }>, result: Readonly<Result<Serializable>>) {
      const { payload: task, pending } = registry;
      pending.then((ftask) => {
        console.log({ logfrom: "TaskContainer onfinalized hook", details: { task, result, timestamps: { overhead: ftask.overhead, date: new Date(Date.now()).toUTCString() } } });
      }).catch(error => {
        console.error({ logfrom: "TaskContainer onfinalized hook", error: error.message || String(error), details: { task, result, timestamps: { date: new Date(Date.now()).toUTCString() } } });
      });
    }
  }
} satisfies Record<string, Partial<TaskContainerHooks>>;