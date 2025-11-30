
/**
 * General purpose types. 
 */

export type Result<T> = {
  ok: true,
  value: T
} | {
  ok: false,
  error: string
}


/**
 * Serialization
 */

interface WritableArrayLike<T> {
  readonly length: number;
  [key: number]: T;
}

interface MemoryView<T extends ArrayBufferLike> extends WritableArrayLike<number | bigint> {
  readonly buffer: T;
  readonly byteLength: number;
  readonly byteOffset: number;
}

// interface MemoryViewConstructor<T extends ArrayBufferLike> {
//   new(buffer: T, byteOffset: number, byteLength: number): MemoryView<T>;
// }

type SerializedPrimitive = number | string | boolean | null | MemoryView<ArrayBufferLike>;
export type Serialized = SerializedPrimitive | Serialized[] | { [key: string]: Serialized };

/**
 * Commands & Tasks
 */

export type Command = {
  routine: string;
  data: Serialized;
}

export type Task = {
  id: number;
  command: Command;
};

export interface DispatchRequest {
  command(): Command;
}

// export interface SerializableFabric<T extends Serialized> {
//   from(raw: T): Serializable<T>;
// };

/**
 * Worker responses.
 */
export type TaskWorkerMessage = {
  task: Task;
  result: Result<Serializable>;
};

/**
 * Task result.
 */
export type FinalizedTask<T extends Serializable> = {
  value: T;
  overhead: number;
}