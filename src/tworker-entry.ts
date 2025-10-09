import { isNode, isBrowser } from "../runtime.js"; // Makes Node.JS `Worker` and `parentPort` available to global scope.
import { Task } from "./task-utils.js";
declare const listen: ((type: "message" | "error", handler: (d: any) => void) => void);
declare const post: ((message: any) => void);

import { WhisperError } from "../runtime.js";
import type { Result, Nullable, ModelController, IContextParams, ITranscriptParams } from "@panprogramadorgh/types"


// FIXME: DEBUGGING WEB ENV WITHOUT BACKEND


class ModelNotConfiguredError extends Error {
  name = "ModelNotConfiguredError";
  constructor() {
    super();
  }
}


type TaskWorkerState = Nullable<{
  model: ModelController;
}>;


if (
  isBrowser &&
  (!(<any>self).Worker || !(<any>self).listen || !(<any>self).post) ||
  isNode &&
  (!(<any>global).Worker || !(<any>global).listen || !(<any>global).post)
) {
  throw new TypeError("Workers API was not found at global scope.");
}


async function entry() {
  const { BackendLoad } = await import("../backend-load/backend-load.js"); /** // FIXME: @see BackendLoad  */
  const { HeapDataContext } = await import("../memory-management.js"); /** // FIXME: @see BackendLoad  */

  const client = await BackendLoad.getClient();
  const HeapData = await HeapDataContext();


  const State: TaskWorkerState = {
    model: null,
  }

  const CommandHandlers: Record<string, (task: Task) => Result<any>> = {
    config(task: Task): Result<null> {
      // 1. checks
      const predicate = (data: any): data is { modelFile: Uint8Array<SharedArrayBuffer>, contextParams: IContextParams } => {
        return (
          data && typeof data == "object" &&
          data.modelFile instanceof Uint8Array &&
          data.modelFile.buffer instanceof SharedArrayBuffer &&
          data.contextParams && typeof data.contextParams == "object" // TODO: Use type predicate instead
        );
      }
      if (!predicate(task.command.data))
        throw new TypeError("CommandHandlers.config");

      // 2. allocs
      const copyAttempt = HeapData.make(task.command.data.modelFile, Uint8Array<SharedArrayBuffer>);
      if (!copyAttempt.ok)
        return copyAttempt;
      const { value: { heapData: modelFile } } = copyAttempt;

      // 3. initializes whisper
      let contextResult: Result<null>;
      try {
        const whisperContextParams = client.createWhisperContextParams(task.command.data.contextParams);

        const modelContext = new client.ContextFromBuffer( // FIXME: Figuring out, what the heck is going on with the model file.
          modelFile.pointer,
          modelFile.byteLength,
          whisperContextParams
        );

        State.model = new client.ModelController(modelContext);

        contextResult = { ok: true, value: null };
      } catch (error: any) {
        contextResult = { ok: false, error: error.message || String(error) };
      } finally { // No matter what, destroy the file at the end.
        try {
          modelFile[Symbol.dispose]();
        } catch (error: any) {
          throw new WhisperError(error.message || String(error));
        }
      }

      return contextResult;
    },

    transcribe(task: Task): Result<string> {
      // 1. checks
      const predicate = (data: any): data is {
        audioFile: Float32Array<SharedArrayBuffer>,
        transcriptParams: ITranscriptParams
      } => {
        return (
          data && typeof data == "object" &&
          data.audioFile instanceof Float32Array &&
          data.audioFile.buffer instanceof SharedArrayBuffer &&
          data.transcriptParams && typeof data.transcriptParams == "object" // TODO: Use type predicate
        );
      }
      if (!State.model)
        throw new ModelNotConfiguredError();
      if (!predicate(task.command.data))
        throw new TypeError("CommandHandlers.transcribe");

      // 2. allocs
      const copyAttempt = HeapData.make(task.command.data.audioFile, Float32Array<SharedArrayBuffer>);
      if (!copyAttempt.ok)
        return copyAttempt;
      const { value: { heapData: audioFile } } = copyAttempt;

      let transcriptResult: Result<string>;
      try {
        const whisperFullParams = client.createWhisperFullParams(task.command.data.transcriptParams, task.command.data.transcriptParams.preset);
        const transcript = State.model.generateTranscript(audioFile.pointer, audioFile.byteLength, whisperFullParams);
        const value = transcript.fullText.get(); // std::future<std::string>::get

        transcriptResult = { ok: true, value };
      } catch (error: any) {
        transcriptResult = { ok: false, error: error.message || String(error) };
      } finally { // No matter what, destroy the file at the end.
        try {
          audioFile[Symbol.dispose]();
        } catch (error: any) {
          throw new WhisperError(error.message || String(error));
        }
      }

      return transcriptResult;
    }
  } satisfies Record<string, (task: Task) => Result<any>>;

  function onmessage(task: Task) {
    if (!Task.predicate(task))
      throw new TypeError("onmessage");

    const commandHandler = CommandHandlers[task.command.type]!;
    const commandResult = commandHandler(task);
    post({ task, result: commandResult });
  }

  listen("message", onmessage);
}

entry().catch(error => { throw new Error(error.message || String(error)) });



// FIXME: Behaviour tests for WEB environment:

// Throw within promise callback.
// Works fine.
// new Promise<void>((r) => {
//   // this is synchronous.
//   r();
// }).then(() => {
//   // this is asynchronous.
//   throw new Error("Intentional exception.");
// });


// Throw after await.
// No response message from worker.
// await new Promise<void>((r) => {
//   // this is synchronous.
//   r();
// });
// // this is asynchronous.
// throw new Error("Intentional exception.");


// Async function + then / catch handling
// Works fine.
// (async function () {
//   throw new Error("FN");
//   return 0;
// })().then(d => self.postMessage(d)).catch(error => { throw new Error(`CATCH: ${error.message || String(error)}`) });


// Same as before, but with entry, that relays on the importation of the package
// DOES NOT WORK.
// entry().then((d) => { self.postMessage(d) }).catch((error) => { throw new Error(`CATCH: ${error.message || String(error)}`) });


// Async function + then / catch handling + package importation.
// If any package importation relays on `BackendLoad` and it does, the message queue dies.
// (async function () {
//   try {
//     const { BackendLoad } = await import("../backend-load/backend-load.js"); // const { Task } = await import("./task-utils.js");
//     // const { isBrowser, isNode } = await import("../runtime.js"); // Makes Node.JS `Worker` and `parentPort` available to global scope.
//     // const { HeapDataContext } = await import("../memory-management.js");
//     // const { Task } = await import("./task-utils.js");

//     console.log(BackendLoad);
//     // console.log({ BackendLoad, Task, isBrowser, isNode, HeapDataContext });
//   } catch (error: any) {
//     throw new Error("FN");
//     // throw new Error(error.message || String(error));
//   }
// })().then(d => self.postMessage(d)).catch(error => { throw new Error(`CATCH: ${error.message || String(error)}`) });

// Same as before due to BackendLoad and how the bundle is generated (top level `LoadModule` imports, which are problematic).
// let timestamp = 0;
// setTimeout(async () => {
//   try {
//     timestamp = performance.now();
//     console.log("Loading module '@whisperjs-web'...");
//     const whisper = await import("../backend-load/backend-load.js");
//     console.log(`Module was loaded in '${performance.now() - timestamp}' milliseconds.`);

//     console.log("Checking testing environment.");
//     const cond = whisper.BackendLoad && typeof whisper.BackendLoad?.getClient == "function";
//     if (!cond) {
//       console.log("Not compliant !");
//       return;
//     } else {
//       console.log("Compliant.");
//     }

//     timestamp = performance.now();
//     console.log("Acquiring client.");
//     const client = await whisper.BackendLoad.getClient();
//     console.log(`Client was acquired in '${performance.now() - timestamp}' milliseconds.`);

//     timestamp = performance.now();
//     console.log("Executing backend healthcheck and posting results.");
//     const result = client.fibonacci(10);
//     console.log(`Healthcheck done in '${performance.now() - timestamp}' milliseconds.`);
//     self.postMessage(result);
//   } catch (error: any) {
//     self.postMessage(error.message || String(error));
//   }
// });