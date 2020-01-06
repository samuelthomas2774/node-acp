
/** A MAC address, formatted as 00-00-00-00-00 */
type MACAddress = string;

import {WirelessNetworkMode} from '../types/properties';

enum Model {
    AIRPORT_EXPRESS_2ND_GENERATION = 115,
    AIRPORT_EXTREME_6TH_GENERATION = 120,
}

export interface AdvertisementData {
    /** Ethernet MAC address */
    waMA: MACAddress;
    /** 5 GHz Wi-Fi MAC address - this is used to identify devices in AirPort Utility */
    raMA: MACAddress;
    /** 2.4 GHz Wi-Fi MAC address */
    raM2: MACAddress;
    /** Wi-Fi network name */
    raNm: string;
    /** 2.4 GHz channel */
    raCh: number;
    /** 5 GHz channel */
    rCh2: number;
    /**
     * Wireless network mode
     *
     * 0 - create a wireless network, 1 - join an existing wireless network, 3 - wireless disabled
     */
    raSt: WirelessNetworkMode;
    /** Enable Network Address Translation */
    raNA: boolean;
    /** Some hexadecimal flags - ?? */
    syFl: string; // '0x820C'
    /** Model */
    syAP: Model;
    /** Version */
    syVs: string;
    /** Source version */
    srcv: string;
    /** ?? */
    bjSd: number;
    /** ?? */
    prob?: string;
}

/**
 * Format _airport._tcp advertisement TXT records as they're merged into a single record.
 *
 * @param {AdvertisementData} data
 * @return {object}
 */
export function createAdvertisementData(data: AdvertisementData): Record<string, string> {
    if (!/^[0-9a-f]{2}(-[0-9a-f]{2}){5}$/i.test(data.waMA)) throw new Error('Invalid data waMA');
    if (!/^[0-9a-f]{2}(-[0-9a-f]{2}){5}$/i.test(data.raMA)) throw new Error('Invalid data raMA');
    if (!/^[0-9a-f]{2}(-[0-9a-f]{2}){5}$/i.test(data.raM2)) throw new Error('Invalid data raM2');
    if (typeof data.raNm !== 'string') throw new Error('Invalid data raNm');
    if (!/^0x[0-9a-f]+$/i.test(data.syFl)) throw new Error('Invalid data syFl');
    if (typeof data.raCh !== 'number') throw new Error('Invalid data raCh');
    if (typeof data.rCh2 !== 'number') throw new Error('Invalid data rCh2');
    if (![0, 1, 3].includes(data.raSt)) throw new Error('Invalid data raSt');
    if (typeof data.raNA !== 'boolean') throw new Error('Invalid data raNA');
    if (typeof data.syVs !== 'string') throw new Error('Invalid data syVs');
    if (typeof data.syAP !== 'number') throw new Error('Invalid data syAP');
    if (typeof data.srcv !== 'string') throw new Error('Invalid data srcv');
    if (typeof data.bjSd !== 'number') throw new Error('Invalid data bjSd');
    if (data.hasOwnProperty('prob') && typeof data.prob !== 'string') throw new Error('Invalid data prob');

    const result: Record<string, string> = {};
    let i: string | null = null;

    for (let [key, value] of Object.entries(data) as [keyof AdvertisementData, AdvertisementData[keyof AdvertisementData]][]) {
        if (typeof value === 'boolean') value = value ? 1 : 0;

        if (typeof i === 'string') {
            result[i] = `${result[i]},${key}=${value}`;
        } else {
            i = key;
            result[key] = `${value}`;
        }
    }

    return result;
}

/**
 * Get advertisement data from the merged _airport._tcp advertisement TXT records.
 *
 * @param {object} data
 * @return {AdvertisementData}
 */
export function getAdvertisementData(data: Record<string, string>): AdvertisementData {
    const result = {} as AdvertisementData;

    for (const [i, d] of Object.entries(data)) {
        const values = d.split(',');
        // @ts-ignore
        result[i] = values.shift();

        for (const v of values) {
            const [key, value] = v.split('=', 2);
            // @ts-ignore
            result[key] = value;
        }
    }

    if (!/^[0-9a-f]{2}(-[0-9a-f]{2}){5}$/i.test(result.waMA)) throw new Error('Invalid data');
    if (!/^[0-9a-f]{2}(-[0-9a-f]{2}){5}$/i.test(result.raMA)) throw new Error('Invalid data');
    if (!/^[0-9a-f]{2}(-[0-9a-f]{2}){5}$/i.test(result.raM2)) throw new Error('Invalid data');
    if (!result.raNm) throw new Error('Invalid data');
    if (!/^0x[0-9a-f]+$/i.test(result.syFl)) throw new Error('Invalid data');
    result.raCh = parseInt('' + result.raCh);
    result.rCh2 = parseInt('' + result.rCh2);
    result.raSt = parseInt('' + result.raSt);
    result.raNA = !!parseInt('' + result.raNA);
    if (!result.syVs) throw new Error('Invalid data');
    result.syAP = parseInt('' + result.syAP);
    if (!result.srcv) throw new Error('Invalid data');
    result.bjSd = parseInt('' + result.bjSd);

    return result;
}

/**
 * JSON reviver function.
 *
 * @param {string} key
 * @param {any} value
 * @return {any}
 */
export function reviver(key: string, value: any) {
    if (typeof value === 'object' && value !== null) {
        const keys = Object.keys(value);

        if (keys.length === 2 && keys.includes('type') && keys.includes('data') && value.type === 'Buffer') return Buffer.from(value.data);
        // eslint-disable-next-line new-cap
        if (keys.length === 2 && keys.includes('type') && keys.includes('data') && value.type === 'bigint') return BigInt(value.data);
        if (keys.length === 2 && keys.includes('type') && keys.includes('data') && value.type === 'Error') {
            const error = new Error(value.data.message);
            // @ts-ignore
            error.code = value.data.code;
            error.stack = value.data.stack;
            return error;
        }
        if (keys.length === 2 && keys.includes('type') && keys.includes('data') && value.type === 'UUID') return new UUID(value.data);
    }

    return value;
}

/**
 * JSON replacer function.
 *
 * @param {string} key
 * @param {any} value
 * @return {any}
 */
export function replacer(key: string, value: any) {
    if (typeof value === 'bigint') return {type: 'bigint', data: value.toString()};
    if (value instanceof Error) {
        // @ts-ignore
        return {type: 'Error', data: {message: value.message, code: value.code, stack: value.stack}};
    }
    if (value instanceof UUID) return {type: 'UUID', data: value.toString()};

    return value;
}

const UUID_REGEX = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

/**
 * UUID.
 */
export class UUID {
    readonly value: Buffer;

    /**
     * @param {Buffer|string} value A UUID as a 16 byte Buffer or string, or a hexadecimal string
     */
    constructor(value: Buffer | string) {
        if (typeof value === 'string' && value.length === 16) {
            value = Buffer.from(value, 'binary');
        }
        if (typeof value === 'string' && value.length === 36 && UUID_REGEX.test(value)) {
            value = Buffer.from(value.replace(/-/g, ''), 'hex');
        }

        if (!(value instanceof Buffer) || value.length !== 16) {
            throw new Error('Invalid UUID data');
        }

        this.value = value;
    }

    /**
     * Returns the UUID as a hexadecimal string.
     *
     * @return {string}
     */
    toString() {
        return this.value.toString('hex')
            .replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/, '$1-$2-$3-$4-$5');
    }

    /**
     * Returns the UUID as a Buffer.
     *
     * @return {Buffer}
     */
    toBuffer() {
        const value = Buffer.alloc(16);
        this.value.copy(value);
        return value;
    }
}

/**
 * Error representing an invalid response received from the server.
 */
export class InvalidResponseError extends Error {
    /**
     * @param {string} message
     * @param {object} response The original response data
     */
    constructor(message: string, readonly response: any) {
        super(message);
    }
}
