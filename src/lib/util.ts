
/** A MAC address, formatted as 00-00-00-00-00 */
type MACAddress = string;

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
    /** ?? */
    raSt: number;
    /** ?? */
    raNA: number;
    /** Some hexidecimal flags - ?? */
    syFl: string; // '0x820C'
    /** Model */
    syAP: number;
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
    if (!/^[0-9a-f]{2}(-[0-9a-f]{2}){5}$/i.test(data.waMA)) throw new Error('Invalid data');
    if (!/^[0-9a-f]{2}(-[0-9a-f]{2}){5}$/i.test(data.raMA)) throw new Error('Invalid data');
    if (!/^[0-9a-f]{2}(-[0-9a-f]{2}){5}$/i.test(data.raM2)) throw new Error('Invalid data');
    if (typeof data.raNm !== 'string') throw new Error('Invalid data');
    if (!/^0x[0-9a-f]+$/i.test(data.syFl)) throw new Error('Invalid data');
    if (typeof data.raCh !== 'number') throw new Error('Invalid data');
    if (typeof data.rCh2 !== 'number') throw new Error('Invalid data');
    if (typeof data.raSt !== 'number') throw new Error('Invalid data');
    if (typeof data.raNA !== 'number') throw new Error('Invalid data');
    if (typeof data.syVs !== 'string') throw new Error('Invalid data');
    if (typeof data.syAP !== 'number') throw new Error('Invalid data');
    if (typeof data.srcv !== 'string') throw new Error('Invalid data');
    if (typeof data.bjSd !== 'number') throw new Error('Invalid data');
    if (data.hasOwnProperty('prob') && typeof data.prob !== 'string') throw new Error('Invalid data');

    const result: Record<string, string> = {};
    let i: string | null = null;

    for (const [key, value] of Object.entries(data)) {
        if (typeof i === 'string') {
            result[i] = `${result[i]},${key}=${value}`;
        } else {
            i = key;
            result[key] = `${value}`;
        }
    }

    return result;
}

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
    result.raNA = parseInt('' + result.raNA);
    if (!result.syVs) throw new Error('Invalid data');
    result.syAP = parseInt('' + result.syAP);
    if (!result.srcv) throw new Error('Invalid data');
    result.bjSd = parseInt('' + result.bjSd);

    return result;
}

export function reviver(key: string, value: any) {
    if (typeof value === 'object') {
        const keys = Object.keys(value);

        if (keys.length === 2 && keys.includes('type') && keys.includes('data') && value.type === 'Buffer') return Buffer.from(value.data);
        if (keys.length === 2 && keys.includes('type') && keys.includes('data') && value.type === 'bigint') return BigInt(value.data);
    }

    return value;
}

export function replacer(key: string, value: any) {
    if (typeof value === 'bigint') return {type: 'bigint', data: value.toString()};

    return value;
}
