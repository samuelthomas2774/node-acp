
import CFLBinaryPList from './cflbinary';
import acp_properties, {PropName, PropTypes} from './properties';
import PropertyValueTypes from './property-types';
import {replacer} from './util';
import {LogLevel, loglevel} from '..';

import ip from 'ip6addr';
import {parseBuffer as parseBPList} from 'bplist-parser';
import composeBPList from 'bplist-creator';

export type PropType = keyof SupportedValues;

interface PropData<N extends PropName = any, T extends PropType = PropTypes[N]> {
    name: N;
    type: T;
    description: string;
    validator: ((value: Buffer, name: N) => boolean) | undefined;
}

interface HeaderData {
    name: PropName;
    flags: number;
    size: number;
}

export function generateACPProperties() {
    const props: PropData[] = [];

    for (let [name, prop] of Object.entries(acp_properties)) {
        let [type, description, validator] = prop;

        if (name.length !== 4) throw new Error('Bad name in ACP properties list: ' + name);

        if (!ValueInitialisers[type]) throw new Error('Bad type in ACP properties list for name: ' + name + ' - ' + type);

        if (!description) throw new Error('Missing description in ACP properties list for name: ' + name);

        if (validator instanceof Array) {
            const valid_values: Buffer[] = validator.map(v => ValueInitialisers[type](v));

            validator = value => !!valid_values.find(v => v.equals(value));
        }

        props.push({name, type, description, validator});
    }

    return props;
}

export type SupportedValues = {
    boo: Buffer | string | boolean;
    ui8: Buffer | string | number;
    u16: Buffer | string | number;
    dec: Buffer | string | number;
    u32: Buffer | string | number;
    u64: Buffer | string | number | bigint;
    hex: Buffer | string | number;
    mac: Buffer | string;
    bin: Buffer | string;
    cfb: any;
    log: Buffer | string;
    str: Buffer | string;
    ip4: Buffer | string;
    ip6: Buffer | string;
    bpl: any;
    uid: Buffer | string;
};

const ValueInitialisers: {
    [T in keyof SupportedValues]: (value: Buffer | string | SupportedValues[T]) => Buffer;
} = {
    boo(value) {
        // Support string true/1/false/0 values for the CLI
        if (value === 'true' || value === '1') value = true;
        if (value === 'false' || value === '0') value = false;

        if (typeof value === 'string') value = Buffer.from(value, 'binary');
        if (value instanceof Buffer) {
            if (value.length !== 1 || ![0, 1].includes(value[0])) throw new Error('Invalid boolean value');
            return value;
        }

        return Buffer.from(value ? '01' : '00', 'hex');
    },
    dec(value) {
        if (value instanceof Buffer) return value;
        if (typeof value === 'string') return Buffer.from(value, 'binary');

        if (typeof value === 'number') {
            const buffer = Buffer.alloc(4);
            buffer.writeUInt32BE(value, 0);
            return buffer;
        }

        throw new Error('Invalid number value: ' + value);
    },
    ui8(value) {
        if (typeof value === 'string' && value.length === 1) return Buffer.from(value, 'binary');
        if (value instanceof Buffer && value.length === 1) return value;

        if (typeof value === 'number') {
            const buffer = Buffer.alloc(1);
            buffer.writeUInt8(value, 0);
            return buffer;
        }

        throw new Error('Invalid uint8 value: ' + value);
    },
    u16(value) {
        if (typeof value === 'string' && value.length === 2) return Buffer.from(value, 'binary');
        if (value instanceof Buffer && value.length === 2) return value;

        if (typeof value === 'number') {
            const buffer = Buffer.alloc(2);
            buffer.writeUInt16BE(value, 0);
            return buffer;
        }

        throw new Error('Invalid uint16 value: ' + value);
    },
    u32(value) {
        if (typeof value === 'string' && value.length === 4) return Buffer.from(value, 'binary');
        if (value instanceof Buffer && value.length === 4) return value;

        if (typeof value === 'number') {
            const buffer = Buffer.alloc(4);
            buffer.writeUInt32BE(value, 0);
            return buffer;
        }

        throw new Error('Invalid uint32 value: ' + value);
    },
    u64(value) {
        if (typeof value === 'string') value = Buffer.from(value, 'binary');
        if (value instanceof Buffer) {
            if (value.length !== 8) throw new Error('Invalid uint64 value');
            return value;
        }
        // eslint-disable-next-line new-cap
        if (typeof value === 'number') value = BigInt(value);

        if (typeof value === 'bigint') {
            const buffer = Buffer.alloc(8);
            buffer.writeBigUInt64BE(value, 0);
            return buffer;
        }

        throw new Error('Invalid uint64 value: ' + value);
    },
    hex(value) {
        if (value instanceof Buffer) return value;
        if (typeof value === 'string') return Buffer.from(value, 'binary');

        if (typeof value === 'number') {
            const buffer = Buffer.alloc(4);
            buffer.writeUInt32BE(value, 0);
            return buffer;
        }

        throw new Error('Invalid hexadecimal value: ' + value);
    },
    mac(value) {
        if (typeof value === 'string' && value.length === 6) return Buffer.from(value, 'binary');
        if (typeof value === 'string') {
            const mac_bytes = value.split(':');
            if (mac_bytes.length === 6) value = Buffer.from(mac_bytes.join(''), 'hex');
        }
        if (value instanceof Buffer && value.length === 6) return value;

        throw new Error('Invalid MAC address value: ' + value);
    },
    bin(value) {
        if (value instanceof Buffer) return value;
        if (typeof value === 'string') return Buffer.from(value, 'binary');
        throw new Error('Invalid binary value: ' + value);
    },
    cfb(value) {
        // TODO: validate this?
        if (value instanceof Buffer) return value;

        return CFLBinaryPList.compose(value);
    },
    log(value) {
        if (value instanceof Buffer) return value;
        if (typeof value === 'string') return Buffer.from(value, 'binary');
        throw new Error('Invalid log value: ' + value);
    },
    str(value) {
        if (value instanceof Buffer) return value;
        if (typeof value === 'string') return Buffer.from(value, 'binary');
        throw new Error('Invalid string value: ' + value);
    },
    ip4(value) {
        if (typeof value === 'string' && value.length === 4) return Buffer.from(value, 'binary');
        if (typeof value === 'string') value = ip.parse(value).toBuffer();
        if (value instanceof Buffer && value.length === 4) return value;

        throw new Error('Invalid IPv4 address value: ' + value);
    },
    ip6(value) {
        if (typeof value === 'string' && value.length === 16) return Buffer.from(value, 'binary');
        if (typeof value === 'string') value = ip.parse(value).toBuffer();
        if (value instanceof Buffer && value.length === 16) return value;

        throw new Error('Invalid IPv6 address value: ' + value);
    },
    bpl(value) {
        if (value instanceof Buffer) return value;

        return composeBPList(value);
    },
    uid(value) {
        if (value instanceof Buffer && value.length === 16) return value;
        if (typeof value === 'string' && value.length === 16) return Buffer.from(value, 'binary');
        if (typeof value === 'string' && /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) {
            return Buffer.from(value.replace(/-/g, ''), 'hex');
        }

        throw new Error('Invalid UUID value: ' + value);
    },
};

export type FormattedValues = {
    boo: boolean;
    dec: number;
    ui8: number;
    u16: number;
    u32: number;
    u64: bigint;
    hex: string;
    mac: string;
    bin: Buffer;
    cfb: any;
    log: string;
    str: string;
    ip4: string;
    ip6: string;
    bpl: any;
    uid: string;
};

export const ValueFormatters: {
    [T in keyof SupportedValues]: (value: Buffer) => FormattedValues[T];
} = {
    boo(value) {
        return !!value[0];
    },
    dec(value) {
        return value.readUIntBE(0, value.length);
    },
    ui8(value) {
        return value.readUInt8(0);
    },
    u16(value) {
        return value.readUInt16BE(0);
    },
    u32(value) {
        return value.readUInt32BE(0);
    },
    u64(value) {
        return value.readBigUInt64BE(0);
    },
    hex(value) {
        return '0x' + value.toString('hex');
    },
    mac(value) {
        const mac_bytes: string[] = [];

        for (let i = 0; i < 6; i++) {
            mac_bytes.push(value.slice(i, i + 1).toString('hex'));
        }

        return mac_bytes.join(':');
    },
    bin(value) {
        // return Buffer.from(value, 'binary').toString('hex');
        return value;
    },
    cfb(value) {
        return CFLBinaryPList.parse(value);
    },
    log(value) {
        return value.toString('binary').split('\x00').map(line => line.trim() + '\n').join('');
    },
    str(value) {
        return value.toString('utf-8');
    },
    ip4(value) {
        return ip.parse('::ffff:' + value.toString('hex').replace(/([a-f0-9]{4})(?!$)/gi, '$1:'))
            .toString({format: 'v4'});
    },
    ip6(value) {
        return ip.parse(value.toString('hex').replace(/([a-f0-9]{4})(?!$)/gi, '$1:')).toString();
    },
    bpl(value) {
        return parseBPList(value)[0];
    },
    uid(value) {
        return value.toString('hex')
            .replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/, '$1-$2-$3-$4-$5');
    },
};

export const HEADER_SIZE = 12;

class Property<
    N extends PropName = any, T extends PropType = PropTypes[N],
    V = N extends keyof PropertyValueTypes ? PropertyValueTypes[N] : FormattedValues[T]
> {
    readonly name: N | undefined;
    readonly value: Buffer | undefined;

    /**
     * Creates a Property.
     *
     * @param {string} name
     * @param {string} value
     */
    constructor(name?: N | '\0\0\0\0', value?: Buffer | string | SupportedValues[T]) {
        if (name === '\x00\x00\x00\x00') {
            name = undefined;
            value = undefined;
        }

        if (name && !this.constructor.getSupportedPropertyNames().includes(name)) {
            throw new Error('Invalid property name passed to Property constructor: ' + name);
        }

        if (value) {
            const prop_type = this.constructor.getPropertyInfoString(name as N, 'type') as PropType;

            if (!prop_type || !ValueInitialisers[prop_type]) throw new Error(`Missing handler for ${prop_type} property type`);

            const v: Buffer = value = ValueInitialisers[prop_type](value);

            const validator = this.constructor.getPropertyInfoString(name as N, 'validator');
            if (validator && !validator(v, name as N)) {
                throw new Error('Invalid value passed to validator for property ' + name + ' - type: ' + typeof value);
            }
        }

        this.name = name as N | undefined;
        this.value = value as Buffer;
    }

    /**
     * Convert the property's value to a JavaScript built in type.
     *
     * @return {*}
     */
    format(): (N extends keyof PropertyValueTypes ? PropertyValueTypes[N] : FormattedValues[T]) | null {
        if (!this.name || !this.value) return null;

        const type = this.constructor.getPropertyInfoString(this.name, 'type') as PropType;

        if (!type || !ValueFormatters[type]) throw new Error(`Missing format handler for ${type} property type`);

        return ValueFormatters[type](this.value);
    }

    toString() {
        return JSON.stringify(this.format(), replacer);
    }

    /**
     * Returns the names of known properties.
     *
     * @return {string[]}
     */
    static getSupportedPropertyNames() {
        return props.map(prop => prop.name);
    }

    get info() {
        return props.find(p => p.name === this.name);
    }

    static getPropertyInfoString<T extends keyof PropData>(propName: string, key: T): PropData[T] {
        if (!propName) return;

        const prop = props.find(p => p.name === propName);

        if (!prop) {
            if (loglevel >= LogLevel.WARNING) console.warn('Property', propName, 'not supported');
            return;
        }

        if (!prop.hasOwnProperty(key)) {
            if (loglevel >= LogLevel.WARNING) console.warn('Invalid property info key', key);
            return;
        }

        return prop[key];
    }

    /**
     * Parses an ACP property.
     *
     * @param {Buffer|string} data
     * @return {Property}
     */
    static parseRawElement(data: Buffer | string) {
        // eslint-disable-next-line no-unused-vars
        const {name, flags, size} = this.unpackHeader(data instanceof Buffer ? data.slice(0, HEADER_SIZE) :
            data.substr(0, HEADER_SIZE));

        // TODO: handle flags
        return new this(name as PropName, data instanceof Buffer ? data.slice(HEADER_SIZE) : data.substr(HEADER_SIZE));
    }

    /**
     * Composes an ACP property.
     *
     * @param {number} flags
     * @param {Property} property
     * @return {Buffer}
     */
    static composeRawElement(flags: number, property: Property) {
        const name = property.name ? property.name : '\x00\x00\x00\x00';
        const value = property.value instanceof Buffer ? property.value :
            typeof property.value === 'number' ? property.value :
                property.value ? Buffer.from(property.value, 'binary') :
                    Buffer.from('\x00\x00\x00\x00', 'binary');

        if (typeof value === 'number') {
            const buffer = Buffer.alloc(4);
            buffer.writeUInt32BE(value, 0);

            return Buffer.concat([this.composeRawElementHeader(name, flags, 4), buffer]);
        } else if (value instanceof Buffer) {
            return Buffer.concat([this.composeRawElementHeader(name, flags, value.length), value]);
        } else {
            throw new Error('Unhandled property type for raw element composition');
        }
    }

    static composeRawElementHeader(name: PropName, flags: number, size: number) {
        try {
            return this.packHeader({name, flags, size});
        } catch (err) {
            if (loglevel >= LogLevel.WARNING) console.error('Error packing property %s, flags %d, size %d - :', name, flags, size, err);
            throw err;
        }
    }

    /**
     * Packs an ACP property header.
     *
     * @param {object} header_data
     * @return {Buffer}
     */
    static packHeader(header_data: HeaderData) {
        const {name, flags, size} = header_data;
        const buffer = Buffer.alloc(12);

        buffer.write(name, 0, 4);
        buffer.writeUInt32BE(flags, 4);
        buffer.writeUInt32BE(size, 8);

        return buffer;
    }

    /**
     * Unpacks an ACP property header.
     *
     * @param {Buffer|string} header_data
     * @return {object}
     */
    static unpackHeader(header_data: Buffer | string): HeaderData {
        if (header_data.length !== HEADER_SIZE) {
            throw new Error('Header data must be 12 characters');
        }

        const buffer = header_data instanceof Buffer ? header_data : Buffer.from(header_data, 'binary');

        const name = buffer.slice(0, 4).toString() as PropName;
        const flags = buffer.readUInt32BE(4);
        const size = buffer.readUInt32BE(8);

        return {name, flags, size};
    }
}

interface Property<N extends PropName = any, T extends PropType = PropTypes[N]> {
    constructor: typeof Property;
}

export default Property;

export interface PropertyWithValue<
    N extends PropName = any, T extends PropType = PropTypes[N],
    V = N extends keyof PropertyValueTypes ? PropertyValueTypes[N] : FormattedValues[T]
> extends Property<N, T, V> {
    readonly name: N;
    readonly value: Buffer;

    format(): (N extends keyof PropertyValueTypes ? PropertyValueTypes[N] : FormattedValues[T]);
}

export const props = generateACPProperties();
