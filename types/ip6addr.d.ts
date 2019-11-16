declare module 'ip6addr' {
    interface ToStringOptions {
        format?: 'auto' | 'v4' | 'v4-mapped' | 'v6';
        zeroElide?: boolean;
        zeroPad?: boolean;
    }

    interface Addr {
        _fields: any[];
        _attrs: object;

        kind(): 'ipv4' | 'ipv6';
        toString(opts?: ToStringOptions): string;
        toBuffer(buf?: Buffer): Buffer;
        toLong(): number;
        clone(): Addr;
        offset(num: number): Addr;
        and(input: Address): Addr;
        or(input: Address): Addr;
        not(input: Address): Addr;
        compare(b: Address): -1 | 0 | 1;
    }

    type Address = string | number | Addr;

    class CIDR {
        _prefix: number;
        _mask: Addr;
        _addr: Addr;

        constructor(address: Addr, length: number);
        contains(input: Address): boolean;
        first(): Addr;
        last(): Addr;
        broadcast(): Addr;
        compare(b: CIDR | string): -1 | 0 | 1;
        prefixLength(format: 'auto' | 'v4' | 'v6'): number;
        address(): Addr;
        toString(opts?: ToStringOptions): string;
    }

    class AddrRange {
        _begin: Addr;
        _end: Addr;

        constructor(being: Address, end: Address);
        contains(input: Address): boolean;
        first(): Addr;
        last(): Addr;
    }

    export function parse(address: Address): Addr;
    export function compare(a: Address, b: Address): -1 | 0 | 1;
    export function createCIDR(address: Address, length: number): CIDR;
    export function compareCIDR(a: CIDR | string, b: CIDR | string): -1 | 0 | 1;
    export function createAddrRange(begin: Address, end: Address): AddrRange;
}
