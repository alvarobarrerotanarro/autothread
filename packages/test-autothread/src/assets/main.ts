/**
 * Web browser Autothread test.
 */

import { WorkerPool } from "@alvarobarrerotanarro/autothread";
import type { DispatchRequest, FinalizedTask, Serialized } from "@alvarobarrerotanarro/autothread-types"

class Void implements DispatchRequest {
  constructor(private routine: string) { }
  command() {
    return {
      routine: this.routine,
      data: null
    };
  }
}

class Fibonacci implements DispatchRequest {
  constructor(private num: number) { }
  command() {
    return {
      routine: "fibonacci",
      data: this.num
    };
  }
}

const pool = new WorkerPool({ entry: "./js/autothread.js" }, {
  optimalTasks() {
    return 2;
  },
  minPoolSize: () => 0
});
const tasks: PromiseLike<FinalizedTask<Serialized>>[] = [];


async function handleClick() {
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
    const task = pool.dispatchGreedy(payload)
    await task.registration
    tasks.push(task.pendingTask);
  }

  /**
   * Microtasks in separated event loops.
   */
  ["green", "brown", "blue"].forEach(async color => {
    const task = pool.dispatchGreedy({
      command() {
        return {
          routine: "countPeopleEyeColor",
          data: color
        }
      }
    });
    await task.registration;
    tasks.push(task.pendingTask);
  });


  for (let task of tasks) {
    console.log(await task);
  }
}

document.querySelector("#btn")?.addEventListener("click", handleClick);
