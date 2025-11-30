/**
 * NodeJS Autothread test.
 */
import "./config.js";
import { WorkerPool } from "@alvarobarrerotanarro/autothread";
class Void {
    routine;
    constructor(routine) {
        this.routine = routine;
    }
    command() {
        return {
            routine: this.routine,
            data: null
        };
    }
}
class Fibonacci {
    num;
    constructor(num) {
        this.num = num;
    }
    command() {
        return {
            routine: "fibonacci",
            data: this.num
        };
    }
}
const pool = new WorkerPool({ entry: "./dist/assets/autothread.js" }, {
    optimalTasks() {
        return 2;
    },
    minPoolSize: () => 0
});
const tasks = [];
const payload = new Fibonacci(40);
/**
 * Health check.
 */
{
    const task = pool.dispatchGreedy(new Void("greet"));
    await task.registration;
    tasks.push(task.pendingTask);
}
/**
 * Heavy work.
 */
for (let i = 0; i < 10; i++) {
    const task = pool.dispatchGreedy(payload);
    await task.registration;
    tasks.push(task.pendingTask);
}
/**
 * Microtasks in separated event loops.
 */
["green", "brown", "blue"].forEach(async (color) => {
    const task = pool.dispatchGreedy({
        command() {
            return {
                routine: "countPeopleEyeColor",
                data: color
            };
        }
    });
    await task.registration;
    tasks.push(task.pendingTask);
});
for (let task of tasks) {
    console.log(await task);
}
//# sourceMappingURL=node.js.map