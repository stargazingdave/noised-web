/** Nested patches preserve sibling controls; arrays are replaced, never merged. */
export type DeepPartial<T> = T extends readonly unknown[] ? T : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export function mergeParams<T>(base: T, patch?: DeepPartial<NoInfer<T>>): T {
    if (Array.isArray(base)) return [...(patch === undefined ? base : patch as unknown as unknown[])] as T;
    if (base !== null && typeof base === 'object') {
        const result: Record<string, unknown> = {};
        const changes = (patch ?? {}) as Record<string, unknown>;
        for (const [key, value] of Object.entries(base)) {
            result[key] = mergeParams(value, changes[key] as DeepPartial<typeof value>);
        }
        for (const [key, value] of Object.entries(changes)) {
            if (!(key in result) && value !== undefined) result[key] = mergeParams(value, undefined);
        }
        return result as T;
    }
    return (patch === undefined ? base : patch) as T;
}
