declare module 'bplist-parser' {
    export class UID {
        UID: number;
        constructor(id: number);
    }

    export function parseFile(path: string, callback?: (err?: Error, result?: any) => void): Promise<any>;
    export function parseBuffer(buffer: Buffer): [any];
}
