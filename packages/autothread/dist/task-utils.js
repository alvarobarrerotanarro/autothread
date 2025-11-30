import { hardwareConcurrency } from "./runtime.js";
import { predicateCommand } from "./predicates.js";
/**
 * Exceptions.
 */
export class UnregisteredTaskError extends TypeError {
    name = "UnregisteredTaskError";
    constructor(taskID) {
        super(`id = '${taskID}'`);
    }
}
;
export class PendingTask {
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
}
/**
 * Pending tasks container.
 */
export class TaskContainer {
    static idGenerator = 0;
    registries = new Map();
    hooks;
    preferences;
    constructor(hooks = {}, preferences = {}) {
        if (!hooks || typeof hooks != "object" ||
            !preferences || typeof preferences != "object") {
            throw new TypeError("TaskContainer");
        }
        const validatedPreferences = {
            maxContainerSize: preferences.maxContainerSize ||
                Math.floor(hardwareConcurrency ** 1.10) + (hardwareConcurrency * 5 - 1)
        };
        this.hooks = hooks;
        this.preferences = validatedPreferences;
    }
    register(cmd) {
        if (!predicateCommand(cmd))
            throw new TypeError("TaskContainer.register");
        if (this.registries.size > this.preferences.maxContainerSize)
            return { ok: false, error: `Max container size reached: '${this.preferences.maxContainerSize}'` };
        const task = { command: cmd, id: TaskContainer.idGenerator++ };
        const registry = { payload: task, pending: new PendingTask() };
        this.registries.set(task.id, registry);
        try {
            if (this.hooks.onregistered)
                this.hooks.onregistered(task);
            return { ok: true, value: registry };
        }
        catch (error) {
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
        }
        catch (error) {
            return { ok: false, error: error.message || String(error) };
        }
    }
}
/**
 * Task container hook sets.
 */
export const TaskContainerBuiltInHooks = {
    inspect: {
        onregistered(task) {
            console.log({ logfrom: "TaskContainer onregistered hook", task });
        },
        onfinalized(registry, result) {
            const { payload: task, pending } = registry;
            pending.then((ftask) => {
                console.log({ logfrom: "TaskContainer onfinalized hook", details: { task, result, timestamps: { overhead: ftask.overhead, date: new Date(Date.now()).toUTCString() } } });
            }).catch(error => {
                console.error({ logfrom: "TaskContainer onfinalized hook", error: error.message || String(error), details: { task, result, timestamps: { date: new Date(Date.now()).toUTCString() } } });
            });
        }
    }
};
//# sourceMappingURL=task-utils.js.map