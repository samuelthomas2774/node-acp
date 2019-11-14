
import CFLBinaryPList from './cflbinary';
import acp_properties from './properties';

interface PropData {
    name: string;
    type: 'str' | 'dec' | 'hex' | 'log' | 'mac' | 'cfb' | 'bin';
    description: string;
    validator: ((value: any, name: string) => boolean) | undefined;
}

interface HeaderData {
    name: string;
    flags: number;
    size: number;
}

export function generateACPProperties() {
    const props: PropData[] = [];

    for (let prop of acp_properties) {
        const [name, type, description, validator] = prop;

        if (name.length !== 4) throw new Error('Bad name in ACP properties list: ' + name);

        const types = ['str', 'dec', 'hex', 'log', 'mac', 'cfb', 'bin'];
        if (!types.includes(type)) throw new Error('Bad type in ACP properties list for name: ' + name + ' - ' + type);

        if (!description) throw new Error('Missing description in ACP properties list for name: ' + name);

        props.push({name, type, description, validator});
    }

    return props;
}

export const props = generateACPProperties();

export const HEADER_SIZE = 12;

class Property {
    readonly name: string | undefined;
    readonly value: any | undefined;

    /**
     * Creates a Property.
     *
     * @param {string} name
     * @param {string} value
     */
    constructor(name?: string, value?: any) {
        if (name === '\x00\x00\x00\x00' && value === '\x00\x00\x00\x00') {
            name = undefined;
            value = undefined;
        }

        if (name && !this.constructor.getSupportedPropertyNames().includes(name)) {
            throw new Error('Invalid property name passed to Property constructor: ' + name);
        }

        if (value) {
            const prop_type = this.constructor.getPropertyInfoString(name, 'type');
            const init_handler_name = `__init_${prop_type}`;

            if (!this[init_handler_name]) throw new Error(`Missing handler for ${prop_type} property type`);

            value = this[init_handler_name](value);

            const validator = this.constructor.getPropertyInfoString(name, 'validator');
            if (validator && !validator(value, name)) {
                throw new Error('Invalid value passed to validator for property ' + name + ' - type: ' + typeof value);
            }
        }

        this.name = name;
        this.value = value;
    }

    __init_dec(value: number | string) {
        if (typeof value === 'number') {
            return value;
        } else if (typeof value === 'string') {
            return Buffer.from(value, 'binary').readUIntBE(0, value.length);
        } else {
            throw new Error('Invalid number value: ' + value);
        }
    }

    __init_hex(value: number | string) {
        if (typeof value === 'number') {
            return value;
        } else if (typeof value === 'string') {
            return Buffer.from(value, 'binary').readUInt32BE(0);
        } else {
            throw new Error('Invalid hex value: ' + value);
        }
    }

    __init_mac(value: string) {
        if (typeof value === 'string') {
            if (value.length === 6) return value;

            const mac_bytes = value.split(':');

            if (mac_bytes.length === 6) {
                return Buffer.from(mac_bytes.join(''), 'hex').toString('binary');
            }
        }

        throw new Error('Invalid mac value: ' + value);
    }

    __init_bin(value: string) {
        if (typeof value === 'string') {
            return value;
        } else {
            throw new Error('Invalid bin value: ' + value);
        }
    }

    __init_cfb(value: string) {
        if (typeof value === 'string') {
            return value;
        } else {
            throw new Error('Invalid cfb value: ' + value);
        }
    }

    __init_log(value: string) {
        if (typeof value === 'string') {
            return value;
        } else {
            throw new Error('Invalid log value: ' + value);
        }
    }

    __init_str(value: string) {
        if (typeof value === 'string') {
            return value;
        } else {
            throw new Error('Invalid str value: ' + value);
        }
    }

    /**
     * Convert the property's value to a JavaScript built in type.
     *
     * @return {*}
     */
    format() {
        if (!this.name || !this.value) return '';

        const propType = this.constructor.getPropertyInfoString(this.name, 'type');
        const formatHandlerName = `__format_${propType}`;

        if (!this[formatHandlerName]) throw new Error(`Missing format handler for ${propType} property type`);

        return this[formatHandlerName](this.value);
    }

    __format_dec(value: number) {
        return value.toString();
    }

    __format_hex(value: number) {
        return '0x' + value.toString(16);
    }

    __format_mac(value: string) {
        const mac_bytes = [];
        value = Buffer.from(value, 'binary').toString('hex');

        for (let i = 0; i < 6; i++) {
            mac_bytes.push(value.substr(i, 2));
        }

        return mac_bytes.join(':');
    }

    __format_bin(value: string) {
        return Buffer.from(value, 'binary').toString('hex');
    }

    __format_cfb(value: string) {
        return CFLBinaryPList.parse(value);
    }

    __format_log(value: string) {
        return value.split('\x00').map(line => line.trim() + '\n').join('');
    }

    __format_str(value: string) {
        return Buffer.from(value, 'binary').toString('utf8');
    }

    toString() {
        return JSON.stringify(this.format());
    }

    /**
     * Returns the names of known properties.
     *
     * @return {Array}
     */
    static getSupportedPropertyNames() {
        return props.map(prop => prop.name);
    }

    static getPropertyInfoString<T extends keyof PropData>(propName: string, key: T): PropData[T] {
        if (!propName) return;

        const prop = props.find(p => p.name === propName);

        if (!prop) {
            console.error('Property', propName, 'not supported');
            return;
        }

        if (!prop[key]) {
            console.error('Invalid property info key', key);
            return;
        }

        return prop[key];
    }

    /**
     * Parses an ACP property.
     *
     * @param {string} data
     * @return {Property}
     */
    static parseRawElement(data: string) {
        // eslint-disable-next-line no-unused-vars
        const {name, flags, size} = this.unpackHeader(data.substr(0, HEADER_SIZE));

        // TODO: handle flags
        return new this(name, data.substr(HEADER_SIZE));
    }

    /**
     * Composes an ACP property.
     *
     * @param {number} flags
     * @param {Property} property
     * @return {string}
     */
    static composeRawElement(flags: number, property: Property) {
        const name = property.name ? property.name : '\x00\x00\x00\x00';
        const value = property.value ? property.value : '\x00\x00\x00\x00';

        if (typeof value === 'number') {
            const buffer = Buffer.alloc(4);
            buffer.writeUInt32BE(value, 0);

            return this.composeRawElementHeader(name, flags, 4) + buffer.toString('binary');
        } else if (typeof value === 'string') {
            return this.composeRawElementHeader(name, flags, value.length) + value;
        } else {
            throw new Error('Unhandled property type for raw element composition');
        }
    }

    static composeRawElementHeader(name: string, flags: number, size: number) {
        try {
            return this.packHeader({name, flags, size});
        } catch (err) {
            console.error('Error packing', name, flags, size, '- :', err);
            throw err;
        }
    }

    /**
     * Packs an ACP property header.
     *
     * @param {object} header_data
     * @return {string}
     */
    static packHeader(header_data: HeaderData) {
        const {name, flags, size} = header_data;
        const buffer = Buffer.alloc(12);

        buffer.write(name, 0, 4);
        buffer.writeUInt32BE(flags, 4);
        buffer.writeUInt32BE(size, 8);

        return buffer.toString('binary');
    }

    /**
     * Unpacks an ACP property header.
     *
     * @param {string} header_data
     * @return {object}
     */
    static unpackHeader(header_data: string): HeaderData {
        if (header_data.length !== HEADER_SIZE) {
            throw new Error('Header data must be 12 characters');
        }

        const buffer = Buffer.from(header_data, 'binary');

        const name = buffer.slice(0, 4).toString();
        const flags = buffer.readUInt32BE(4);
        const size = buffer.readUInt32BE(8);

        return {name, flags, size};
    }
}

interface Property {
    constructor: typeof Property;
}

export default Property;
