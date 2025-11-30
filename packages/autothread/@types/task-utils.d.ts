import type { Result, Task, FinalizedTask, Serialized, Command } from "@alvarobarrerotanarro/autothread-types";
/**
 * Exceptions.
 */
export declare class UnregisteredTaskError extends TypeError {
    name: string;
    constructor(taskID: number);
}
export declare class PendingTask<T extends Serialized> {
    private readonly promise;
    private readonly resolve;
    private readonly reject;
    private readonly timestamp;
    constructor();
    done(result: Result<T>): void;
    then(onfulfilled?: ((value: FinalizedTask<T>) => any | PromiseLike<any>) | null | undefined, onrejected?: ((reason: any) => PromiseLike<never>) | null | undefined): Promise<any>;
}
type TaskContainerHooks = {
    onregistered: (task: Readonly<Task>) => void;
    onfinalized: (registry: Readonly<{
        payload: Task;
        pending: PendingTask<Serialized>;
    }>, result: Readonly<Result<Serialized>>) => void;
};
type TaskContainerPreferences = {
    maxContainerSize: number;
};
/**
 * Pending tasks container.
 */
export declare class TaskContainer {
    private static idGenerator;
    private readonly registries;
    private readonly hooks;
    private readonly preferences;
    constructor(hooks?: Partial<TaskContainerHooks>, preferences?: Partial<TaskContainerPreferences>);
    register<T extends Serialized>(cmd: Command): Result<{
        payload: Task;
        pending: PendingTask<T>;
    }>;
    finalize(task: Task, result: Result<Serialized>): Result<null>;
}
/**
 * Task container hook sets.
 */
export declare const TaskContainerBuiltInHooks: {
    inspect: {
        onregistered(task: Task): void;
        onfinalized(registry: Readonly<{
            payload: Task;
            pending: PendingTask<Serialized>;
        }>, result: Readonly<Result<Serialized>>): void;
    };
};
export {};
//# sourceMappingURL=task-utils.d.ts.map