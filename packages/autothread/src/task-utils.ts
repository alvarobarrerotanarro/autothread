import type { Result, Task, FinalizedTask, Serialized, Command } from "@alvarobarrerotanarro/autothread-types"
import { hardwareConcurrency } from "./runtime.js";
import { predicateCommand } from "./predicates.js";

/**
 * Exceptions.
 */

export class UnregisteredTaskError extends TypeError {
  name = "UnregisteredTaskError";
  constructor(taskID: number) {
    super(`id = '${taskID}'`);
  }
};

export class PendingTask<T extends Serialized> {
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

  done(result: Result<T>) {
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


type TaskContainerHooks = {
  onregistered: (task: Readonly<Task>) => void;
  onfinalized: (registry: Readonly<{ payload: Task, pending: PendingTask<Serialized> }>, result: Readonly<Result<Serialized>>) => void;
}

type TaskContainerPreferences = {
  maxContainerSize: number;
}

/**
 * Pending tasks container.
 */
export class TaskContainer {
  private static idGenerator = 0;

  private readonly registries = new Map<number, { payload: Task, pending: PendingTask<Serialized> }>();
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

  register<T extends Serialized>(cmd: Command): Result<{ payload: Task, pending: PendingTask<T> }> {
    if (!predicateCommand(cmd))
      throw new TypeError("TaskContainer.register");
    if (this.registries.size > this.preferences.maxContainerSize)
      return { ok: false, error: `Max container size reached: '${this.preferences.maxContainerSize}'` }

    const task = { command: cmd, id: TaskContainer.idGenerator++ }
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

  finalize(task: Task, result: Result<Serialized>): Result<null> {
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
    onfinalized(registry: Readonly<{ payload: Task, pending: PendingTask<Serialized> }>, result: Readonly<Result<Serialized>>) {
      const { payload: task, pending } = registry;
      pending.then((ftask) => {
        console.log({ logfrom: "TaskContainer onfinalized hook", details: { task, result, timestamps: { overhead: ftask.overhead, date: new Date(Date.now()).toUTCString() } } });
      }).catch(error => {
        console.error({ logfrom: "TaskContainer onfinalized hook", error: error.message || String(error), details: { task, result, timestamps: { date: new Date(Date.now()).toUTCString() } } });
      });
    }
  }
} satisfies Record<string, Partial<TaskContainerHooks>>;