
export const HEADER_MAGIC = 'CFB0';
export const FOOTER_MAGIC = 'END!';
export const HEADER_SIZE = HEADER_MAGIC.length;
export const FOOTER_SIZE = FOOTER_MAGIC.length;

export default class CFLBinaryPList {
    /**
     * Compose JavaScript object into equivalent plist.
     *
     * @param {*} object
     * @return {string} data
     */
    static compose(object: any) {
        return CFLBinaryPListComposer.compose(object);
    }

    /**
     * Parse plist data into equivalent JavaScript built in.
     *
     * @param {string} data
     * @return {*}
     */
    static parse(data: string) {
        return CFLBinaryPListParser.parse(data);
    }
}

export class CFLBinaryPListComposer {
    /**
     * Compose JavaScript object into equivalent plist.
     *
     * @param {*} object
     * @return {string} data
     */
    static compose(object: any) {
        let data = HEADER_MAGIC;

        data += this.packObject(object);

        data += FOOTER_MAGIC;

        return data;
    }

    /**
     * Pack a supported JavaScript built in object.
     *
     * @param {*} object
     * @param {number} depth
     * @return {string} data
     */
    static packObject(object: any, depth = 1) {
        let data = '';

        if (object === undefined || object === null) {
            data += '\x00';
        } else if (typeof object === 'boolean') {
            data += object ? '\x09' : '\x08';
        } else if (typeof object === 'number' && object % 1 !== 0) {
            let string = '';
            let size = null;

            const sizes = {4: 'FloatBE', 8: 'DoubleBE'};
            for (size of Object.keys(sizes)) {
                size = parseInt(size);

                try {
                    const buffer = Buffer.alloc(size);
                    buffer['write' + sizes[size]](object, 0, size);

                    string = buffer.toString('binary');
                    break;
                } catch (err) {
                    size = null;
                }
            }

            if (size === null) {
                throw new Error('Unsupported real size');
            }

            const marker = 0x20 + Math.log2(string.length);

            data += String.fromCharCode(marker);
            data += string;
        } else if (typeof object === 'number') {
            let string = '';
            let size = null;

            const sizes = {1: '8', 2: '16BE', 4: '32BE'};
            for (size of Object.keys(sizes)) {
                size = parseInt(size);

                try {
                    const buffer = Buffer.alloc(size);
                    buffer.writeUIntBE(object, 0, size);

                    string = buffer.toString('binary');
                    break;
                } catch (err) {
                    size = null;
                }
            }

            if (size === null) {
                throw new Error('Unsupported int size');
            }

            const marker = 0x10 + Math.log2(string.length);

            data += String.fromCharCode(marker);
            data += string;
        } else if (typeof object === 'object' && object instanceof Buffer) {
            if (object.length >= 0xf) {
                data += String.fromCharCode(0x4f);
                data += this.packObject(object.length, depth + 1);
            } else {
                data += String.fromCharCode(0x40 + object.length);
            }

            data += object.toString('binary');
        } else if (typeof object === 'string') {
            data += '\x70';
            data += Buffer.from(object, 'utf8').toString('binary');
            data += '\x00';
        } else if (typeof object === 'object' && object instanceof Array || object instanceof Set) {
            data += '\xa0';

            for (let element of object as any[]) {
                data += this.packObject(element, depth + 1);
            }

            data += '\x00';
        } else if (typeof object === 'object' && object instanceof Map) {
            data += '\xd0';

            for (let [key, value] of object.entries() as unknown as [any, any][]) {
                data += this.packObject(key, depth + 1);
                data += this.packObject(value, depth + 1);
            }

            data += '\x00';
        } else if (typeof object === 'object') {
            data += '\xd0';

            for (let key in object) {
                if (!object.hasOwnProperty(key)) continue;

                data += this.packObject(key, depth + 1);
                data += this.packObject(object[key], depth + 1);
            }

            data += '\x00';
        } else {
            throw new Error('Unsupported object');
        }

        return data;
    }
}

export class CFLBinaryPListParser {
    /**
     * Parse plist data into equivalent JavaScript built in.
     *
     * @param {string} data
     * @return {*}
     */
    static parse(data: string) {
        if (data.length < HEADER_SIZE + FOOTER_SIZE + 1) {
            throw new Error('Not enough data to parse');
        }

        const header_data = data.substr(0, HEADER_SIZE);
        if (header_data !== HEADER_MAGIC) {
            throw new Error('Bad header magic');
        }

        const [object, remaining_data] = this.unpackObject(data.substr(HEADER_SIZE));

        if (remaining_data.length > FOOTER_SIZE) {
            throw new Error('Extra data found after unpacking root object: expected ' + FOOTER_SIZE + ' but found ' + remaining_data.length + ' - ' + Buffer.from(remaining_data, 'binary').toString('hex'));
        }

        if (remaining_data !== FOOTER_MAGIC) {
            throw new Error('Bad footer magic');
        }

        return object;
    }

    /**
     * Unpack an object from the provided data.
     *
     * @param {string} data
     * @param {number} depth
     * @return {Array}
     */
    static unpackObject(data: string, depth = 1): [any, string] {
        if (depth > 10) {
            throw new Error('Max depth reached');
        }

        // let object = null;
        let marker;

        [marker, data] = this.unpackObjectMarker(data);
        const object_type = marker & 0xf0;
        const object_info = marker & 0x0f;

        if (object_type === 0x00) {
            // null/boolean

            if (object_info === 0x00) {
                return [null, data];
            } else if (object_info === 0x08) {
                return [false, data];
            } else if (object_info === 0x09) {
                return [true, data];
            }

            throw new Error('Unsupported object info value for object type 0x00: ' + object_info);
        } else if (object_type === 0x10) {
            // big-endian int
            return this.unpackInt(object_info, data);
        } else if (object_type === 0x20) {
            // big-endian real
            return this.unpackReal(object_info, data);
        } else if (object_type === 0x30) {
            // date
            throw new Error('Dates not implemented');
        } else if (object_type === 0x40) {
            // data
            let size;
            [size, data] = this.unpackCount(object_info, data);

            return [Buffer.from(data.substr(0, size), 'binary'), data.substr(size)];
        } else if (object_type === 0x50) {
            // ASCII string
            throw new Error('ASCII strings not implemented');
        } else if (object_type === 0x60) {
            // Unicode string
            throw new Error('Unicode strings not implemented');
        } else if (object_type === 0x70) {
            // null terminated UTF8 string
            let string = '';

            while (true) {
                if (!data.length) {
                    throw new Error('Not enough data');
                }

                const byte = data.substr(0, 1);
                data = data.substr(1);

                if (byte === '\x00') break;

                string += byte;
            }

            const object = Buffer.from(string, 'binary').toString('utf8');
            return [object, data];
        } else if (object_type === 0x80) {
            // uid
            throw new Error('uids not implemented');
        } else if (object_type === 0xa0) {
            // array
            const object = [];

            while (true) {
                let element;
                [element, data] = this.unpackObject(data, depth + 1);

                if (element === null) break;

                object.push(element);
            }

            return [object, data];
        } else if (object_type === 0xb0) {
            // ordset
            throw new Error('ordsets not implemented');
        } else if (object_type === 0xc0) {
            // set
            throw new Error('sets not implemented');
        } else if (object_type === 0xd0) {
            // dict

            const object = {};

            while (true) {
                let key;
                let value;
                [key, data] = this.unpackObject(data, depth + 1);

                if (key === null) break;

                [value, data] = this.unpackObject(data, depth + 1);

                object[key] = value;
            }

            return [object, data];
        }

        throw new Error('Unsupported object type: ' + object_type);
    }

    /**
     * Unpack an object marker from the provided data.
     *
     * @param {string} data
     * @return {Array}
     */
    static unpackObjectMarker(data: string): [number, string] {
        const marker_byte = data.substr(0, 1);

        const marker = Buffer.from(marker_byte, 'binary').readInt8(0);

        return [marker, data.substr(1)];
    }

    /**
     * Unpack an int object as a JavaScript number from the provided data.
     *
     * @param {number} size_exponent
     * @param {string} data
     * @return {Array}
     */
    static unpackInt(size_exponent: number, data: string): [number, string] {
        const int_size = 2 ** size_exponent;
        const int_bytes = data.substr(0, int_size);
        data = data.substr(int_size);

        return [Buffer.from(int_bytes, 'binary').readUIntBE(0, int_size), data];
    }

    /**
     * Unpack a real object as a JavaScript number from the provided data.
     *
     * @param {number} size_exponent
     * @param {string} data
     * @return {Array}
     */
    static unpackReal(size_exponent: number, data: string): [number, string] {
        const real_size = 2 ** size_exponent;
        const real_bytes = data.substr(0, real_size);
        data = data.substr(real_size);

        if (real_size === 4) {
            return [Buffer.from(real_bytes, 'binary').readFloatBE(0), data];
        } else if (real_size === 8) {
            return [Buffer.from(real_bytes, 'binary').readDoubleBE(0), data];
        }

        throw new Error('Unsupported real packed object size of ' + real_size + ' bytes');
    }

    /**
     * Unpack count from object info nibble and/or packed int value.
     *
     * @param {number} object_info
     * @param {string} data
     * @return {Array}
     */
    static unpackCount(object_info: number, data: string): [number, string] {
        if (object_info === 0x0f) {
            // Count is the following packed int object

            let marker;
            [marker, data] = this.unpackObjectMarker(data);

            const count_object_type = marker & 0xf0;
            const count_object_info = marker & 0x0f;

            if (count_object_type !== 0x10) {
                throw new Error('Expected count to be a packed int object');
            }

            return this.unpackInt(count_object_info, data);
        }

        return [object_info, data];
    }
}
