
import acpProperties from './properties';

export function generateACPProperties() {
    const props = [];
    for (let prop of acpProperties) {
        const [name, type, description, validate] = prop;
        if (name.length !== 4) throw new Error('Bad name in ACP properties list: ' + name);
        const types = ['str', 'dec', 'hex', 'log', 'mac', 'cfb', 'bin'];
        if (!types.includes(type)) throw new Error('Bad type in ACP properties list for name: ' + name + ' - ' + type);
        if (!description) throw new Error('Missing description in ACP properties list for name: ' + name);
        props.push({ name, type, description, validate });
    }
    return props;
}

export const props = generateACPProperties();

export const elementHeaderSize = 12;

export default class Property {

    constructor(name, value) {
        if (name === '\x00\x00\x00\x00' && value === '\x00\x00\x00\x00') {
            name = undefined;
            value = undefined;
        }

        if (name && !this.constructor.getSupportedPropertyNames().includes(name))
            throw new Error('Invalid property name passed to Property constructor: ' + name);

        if (value) {
            const propType = this.constructor.getPropertyInfoString(name, 'type');
            const initHandlerName = `__init_${propType}`;

            if (!this[initHandlerName]) throw new Error(`Missing handler for ${propType} property type`);

            try {
                value = this[initHandlerName](value);
            } catch (err) {
                throw new Error(JSON.stringify(err, null, 4) + ' provided for ' + propType + ' property type ' + value);
            }

            const validate = this.constructor.getPropertyInfoString(name, 'validate');
            if (validate && !validate(value))
                throw new Error('Invalid value passed to validator for property ' + name + ' - type: ' + typeof value);
        }

        this.name = name;
        this.value = value;
    }

    __init_dec(value) {
        if (typeof value === 'number') {
            return value;
        } else if (typeof value === 'string') {
            return Buffer.from(value, 'binary').readUInt32BE(0);
        } else {
            throw new Error('Invalid number value: ' + value);
        }
    }

    __init_hex(value) {
        if (typeof value === 'number') {
            return value;
        } else if (typeof value === 'string') {
            return Buffer.from(value, 'binary').readUInt32BE(0);
        } else {
            throw new Error('Invalid hex value: ' + value);
        }
    }

    __init_mac(value) {
        if (typeof value === 'string') {
            if (value.length === 6) return value;

            const macBytes = value.split(':');
            if (macBytes.length === 6)
                return ('').join(macBytes); // unhex
        }

        throw new Error('Invalid mac value: ' + value);
    }

    __init_bin(value) {
        if (typeof value === 'string') {
            return value;
        } else {
            throw new Error('Invalid bin value: ' + value);
        }
    }

    __init_cfb(value) {
        if (typeof value === 'string') {
            return value;
        } else {
            throw new Error('Invalid cfb value: ' + value);
        }
    }

    __init_log(value) {
        if (typeof value === 'string') {
            return value;
        } else {
            throw new Error('Invalid log value: ' + value);
        }
    }

    __init_str(value) {
        if (typeof value === 'string') {
            return value;
        } else {
            throw new Error('Invalid str value: ' + value);
        }
    }

    format() {
        if (!this.name || !this.value) return '';

        const propType = this.constructor.getPropertyInfoString(this.name, 'type');
        const formatHandlerName = `__format_${propType}`;

        if (!this[formatHandlerName]) throw new Error(`Missing format handler for ${propType} property type`);

        return this[formatHandlerName](this.value);
    }

    __format_dec(value) {
        return value.toString();
    }

    __format_hex(value) {
        return '0x' + value.toString(16);
    }

    __format_mac(value) {
        const mac_bytes = [];

        for (let i = 0; i < 6; i++) {
            mac_bytes.push(value.substr(i, 1));
        }

        return implode(':', mac_bytes);
    }

    __format_bin(value) {
        return value.toString();
    }

    __format_cfb(value) {
        return value.toString();
    }

    __format_log(value) {
        return value.toString();
    }

    toString() {
        return this.format();
    }

    static getSupportedPropertyNames() {
        return props.map(prop => prop.name);
    }

    static getPropertyInfoString(propName, key) {
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

    static async parseRawElement(data) {
        const { name, flags, size } = await this.parseRawElementHeader(data.substr(0, elementHeaderSize));
        // TODO: handle flags
        return new this(name, data.substr(elementHeaderSize));
    }

    static async parseRawElementHeader(data) {
        return this.unpackHeader(data);
    }

    static composeRawElement(flags, property) {
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

    static composeRawElementHeader(name, flags, size) {
        try {
            return this.packHeader({name, flags, size});
        } catch (err) {
            console.error('Error packing', name, flags, size, '- :', err);
            throw err;
        }
    }

    static packHeader(header_data) {
        const {name, flags, size} = header_data;
        const buffer = Buffer.alloc(12);

        buffer.write(name, 0, 4);
        buffer.writeUInt32BE(flags, 4);
        buffer.writeUInt32BE(size, 8);

        return buffer.toString('binary');
    }

    static unpackHeader(header_data) {
        if (header_data.length !== elementHeaderSize)
            throw new Error('Header data must be 12 characters');

        const buffer = Buffer.from(header_data, 'binary');

        const name = buffer.slice(0, 4).toString();
        const flags = buffer.readUInt32BE(4);
        const size = buffer.readUInt32BE(8);

        return {name, flags, size};
    }

}
