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
//# sourceMappingURL=runtime.d.ts.map