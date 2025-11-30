import type { Command, FinalizedTask, Result, Serialized, Task, TaskWorkerMessage } from "@alvarobarrerotanarro/autothread-types";
import { TaskContainer } from "./task-utils.js";
export type TaskWorkerHooks = {
    ontaskdone(message: TaskWorkerMessage): void;
    ontaskdispatched(task: Task): void;
};
type TaskWorkerOptions = {
    entry: string;
    tcontainer: TaskContainer;
    hooks: Partial<TaskWorkerHooks>;
};
/**
 * Used to dispatch tasks. Each worker has a workload based on the number of tasks, ignoring the computation effort each of which may entail.
 */
export declare class TaskWorker {
    private readonly tcontainer;
    private readonly hooks;
    private readonly rworker;
    constructor(options: TaskWorkerOptions);
    dispatch<T extends Serialized>(cmd: Command): Result<PromiseLike<FinalizedTask<T>>>;
    terminate(): void;
}
export {};
//# sourceMappingURL=tworker.d.ts.map