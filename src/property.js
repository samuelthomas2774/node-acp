
import acpProperties from './properties';

const struct = require('python-struct');

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

export const elementHeaderFormat = '!4s2I';
export const elementHeaderSize = struct.sizeOf(elementHeaderFormat);

export default class Property {

    constructor(name, value) {
        if (name === '\x00\x00\x00\x00' && value === '\x00\x00\x00\x00') {
            name = undefined;
            value = undefined;
        }

        if (name && !Property.getSupportedPropertyNames().includes(name))
            throw new Error('Invalid property name passed to Property constructor: ' + name);

        if (value) {
            const propType = this.getPropertyInfoString(name, 'type');
            const initHandlerName = `__init_${propType}`;
            if (!this[initHandlerName]) throw new Error(`Missing handler for ${propType} property type`);
            const initHandler = this[initHandlerName];

            console.debug('Old value:', value, '- type:', typeof value);
            try {
                value = initHandler(value);
            } catch (err) {
                throw new Error(JSON.stringify(err, null, 4) + ' provided for ' + propType + ' property type ' + value);
            }

            console.debug('New value:', value, '- type:', typeof value);

            const validate = Property.getPropertyInfoString(name, 'validate');
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
            return parseInt(value);
        } else {
            throw new Error('Invalid number value: ' + value);
        }
    }

    __init_hex(value) {
        if (typeof value === 'number') {
            return value;
        } else if (typeof value === 'string') {
            return value;
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

    toString() {
        if (!this.name || !this.value) return '';

        const propType = this.getPropertyInfoString(this.name, 'type');
        const formatHandlerName = `__format_${propType}`;

        // For now just return string value
        return this.value.toString();
    }

    static getSupportedPropertyNames() {
        return props.map(prop => prop.name);
    }

    static getPropertyInfoString(cls, propName, key) {
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
        return new Property(name, data.substr(elementHeaderSize));
    }

    static async parseRawElementHeader(data) {
        return struct.unpack(elementHeaderFormat, Buffer.from(data, 'binary'));
    }

    static composeRawElement(flags, property) {
        const name = property.name ? property.name : '\x00\x00\x00\x00';
        const value = property.value ? property.value : '\x00\x00\x00\x00';

        if (typeof value === 'number') {
            return this.composeRawElementHeader(name, flags, struct.sizeOf('>I')) + struct.pack('>I', [value]);
        } else if (typeof value === 'string') {
            return this.composeRawElementHeader(name, flags, value.length) + value;
        } else {
            throw new Error('Unhandled property type for raw element composition');
        }
    }

    static composeRawElementHeader(name, flags, size) {
        try {
            return struct.pack(elementHeaderFormat, [name, flags, size]).toString('binary');
        } catch (err) {
            console.error('Error packing', name, flags, size, '- :', err);
        }
    }

}
