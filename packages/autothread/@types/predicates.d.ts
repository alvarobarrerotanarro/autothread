import type { Command, Result, Task, TaskWorkerMessage } from "@alvarobarrerotanarro/autothread-types";
export declare function predicateResult(maybe: unknown): maybe is Result<any>;
export declare function predicateCommand(maybe: unknown): maybe is Command;
export declare function predicateTask(maybe: unknown): maybe is Task;
export declare function predicateTWorkerMessage(maybe: unknown): maybe is TaskWorkerMessage;
//# sourceMappingURL=predicates.d.ts.map