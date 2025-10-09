import { IContextParams, IMemoryView, ITranscriptParams } from "@panprogramadorgh/types"


type SerializablePrimitive = number | string | boolean | null | IMemoryView<ArrayBufferLike>;
export type Serializable = SerializablePrimitive | Serializable[] | { [key: string]: Serializable };


export type Command = {
  type: string;
  data: Serializable
};

export const Command = {
  /**
   * Equivalent command handler's return type is `Result<null>`
   */
  config(modelFile: Uint8Array<SharedArrayBuffer>, contextParams?: IContextParams): Readonly<Command> {
    return {
      type: "config",
      data: { modelFile, contextParams: contextParams || {} } as unknown as Serializable
    }
  },

  /**
   * Kills the worker .
   */
  abort(): Readonly<Command> {
    return {
      type: "abort",
      data: {}
    };
  },

  /**
   * Calls Model::transcribe_gen.
   * 
   * Equivalent command handler's return type is `Result<string>`
   */
  transcribe(audioFile: Float32Array<SharedArrayBuffer>, transcriptParams?: ITranscriptParams): Readonly<Command> {
    return {
      type: "transcribe",
      data: { audioFile, transcriptParams: transcriptParams || {} } as unknown as Serializable
    };
  }
} satisfies { [key: string]: (...args: any[]) => Readonly<Command> };


export function predicateCommand(maybeCommand: any): maybeCommand is Command {
  const validCommands = Object.keys(Command);
  if (maybeCommand == null || typeof maybeCommand != "object")
    return false;
  else if (typeof maybeCommand["type"] != "string")
    return false;
  else if (!validCommands.includes(maybeCommand["type"]))
    return false;
  else if (typeof maybeCommand["data"] == "undefined")
    return false;
  return true;
}