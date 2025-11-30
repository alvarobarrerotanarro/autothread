import type { FinalizedTask, Serialized, DispatchRequest } from "@alvarobarrerotanarro/autothread-types";
import { type TaskWorkerHooks } from "./tworker.js";
import { TaskContainer } from "./task-utils.js";
/**
 * Exceptions.
 */
export declare class UnregisteredTaskWorkerError extends TypeError {
    name: string;
    constructor(tworkerID: number);
}
export declare class WorkerPoolDispatchError extends Error {
    name: string;
}
export type DispatchRegistration<T extends Serialized> = {
    registration: Promise<number>;
    pendingTask: PromiseLike<FinalizedTask<T>>;
};
type WorkerPoolPreferences = {
    /**
     * Optimal number of tasks per worker.
     */
    optimalTasks(params: {
        hc: number;
        cw: number;
    }): number;
    /**
     * Maximum number of workers within the pool.
     * @hint Using a pool size over `hardwareConcurrency` may be unefficient.
     */
    maxPoolSize(params: {
        hc: number;
    }): number;
    /**
     *
     * @hint Very small values for `hc` may be unefficient if the pool increments and decrements in size very frequently.
     */
    minPoolSize(params: {
        hc: number;
    }): number;
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
    tworkerHooks?: Partial<TaskWorkerHooks>;
};
/**
 * Handles multiple workers and dispatch tasks to them (such as transcripts). Each worker is initially configured with the model file.
 */
export declare class WorkerPool {
    private static idGenerator;
    private readonly registries;
    private readonly entry;
    private readonly tcontainer;
    private readonly tworkerHooks;
    private readonly preferences;
    constructor(options: WorkerPoolOptions, preferences?: Partial<WorkerPoolPreferences>);
    get parallelismDemand(): number;
    /**
     * Internal helper used to register tasks.
     * @param pool Any WorkerPool.
     * @returns The designated worker ID.
     */
    private static register;
    abortAll(): Promise<void>;
    /**
     * @param task The unregistered task to dispatch to the pool.
     */
    private dispatchByID;
    /**
     * Dispatch a task to the worker with least workload.
     * @param task The unregistered task to dispatch to the pool.
     */
    dispatchGreedy<T extends Serialized>(req: DispatchRequest): DispatchRegistration<T>;
}
export {};
//# sourceMappingURL=worker-pool.d.ts.map