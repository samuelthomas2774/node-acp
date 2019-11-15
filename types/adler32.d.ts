declare module 'adler32' {
    export function sum(data: Buffer, sum?: number | null): number;
    export function roll(sum: number, length: number, old_byte: number, new_byte?: number | null): number;
}
