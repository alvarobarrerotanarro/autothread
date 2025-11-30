export declare class UnsupportedRuntime extends Error {
    name: string;
    constructor();
}
export declare const isNode: boolean;
export declare const isBrowserMain: boolean;
export declare const isBrowserWorker: boolean;
export declare const isBrowser: boolean;
/**
 * The number of logic processors available for this thread (web worker | worker thread | main thread)
 */
export declare const hardwareConcurrency: number;
/**
 * The underlying Worker API.
 */
export declare class RuntimeWorker {
    private controller;
    constructor(entry: URL | string);
    listen<T extends "message" | "error">(type: T, onincomingevent: (event: T extends "message" ? any : T extends "error" ? Error : never) => void): void;
    post(message: any): void;
    terminate(): void;
}
//# sourceMappingURL=runtime.d.ts.map