
export const HEADER_MAGIC = 'CFB0';
export const FOOTER_MAGIC = 'END!';
export const HEADER_SIZE = HEADER_MAGIC.length;
export const FOOTER_SIZE = FOOTER_MAGIC.length;

/**
 * Parse/compose CFL binary property lists.
 */
export default class CFLBinaryPList {
    /**
     * Compose JavaScript object into equivalent plist.
     *
     * @param {*} object
     * @return {Buffer} data
     */
    static compose(object: any) {
        return CFLBinaryPListComposer.compose(object);
    }

    /**
     * Parse plist data into equivalent JavaScript built in.
     *
     * @param {Buffer|string} data
     * @return {*}
     */
    static parse(data: Buffer | string) {
        return CFLBinaryPListParser.parse(data);
    }
}

/**
 * Compose CFL binary property lists.
 */
export class CFLBinaryPListComposer {
    /**
     * Compose JavaScript object into equivalent plist.
     *
     * @param {*} object
     * @return {string} data
     */
    static compose(object: any) {
        return Buffer.concat([
            Buffer.from(HEADER_MAGIC, 'binary'),
            this.packObject(object),
            Buffer.from(FOOTER_MAGIC, 'binary'),
        ]);
    }

    /**
     * Pack a supported JavaScript built in object.
     *
     * @param {*} object
     * @param {number} depth
     * @return {string} data
     */
    static packObject(object: any, depth = 1): Buffer {
        if (object === undefined || object === null) {
            return Buffer.from([0x00]);
        } else if (typeof object === 'boolean') {
            return Buffer.from([object ? 0x09 : 0x08]);
        } else if (typeof object === 'number' && object % 1 !== 0) {
            let string = '';
            let size: string | number | null = null;

            const sizes: {[size: number]: 'writeFloatBE' | 'writeDoubleBE'} = {4: 'writeFloatBE', 8: 'writeDoubleBE'};
            for (size of Object.keys(sizes) as string[]) {
                size = parseInt(size);

                try {
                    const buffer = Buffer.alloc(size);
                    buffer[sizes[size]](object, 0);

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
            return Buffer.concat([Buffer.from([marker]), Buffer.from(string, 'binary')]);
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
            return Buffer.concat([Buffer.from([marker]), Buffer.from(string, 'binary')]);
        } else if (typeof object === 'bigint') {
            const buffer = Buffer.alloc(8);
            buffer.writeBigUInt64BE(object, 0);

            const marker = 0x10 + Math.log2(8);
            return Buffer.concat([Buffer.from([marker]), buffer]);
        } else if (typeof object === 'object' && object instanceof Buffer) {
            return Buffer.concat([
                object.length >= 0xf ? Buffer.concat([
                    Buffer.from([0x4f]),
                    this.packObject(object.length, depth + 1),
                ]) : Buffer.from([0x40 + object.length]),
                object,
            ]);
        } else if (typeof object === 'string') {
            return Buffer.concat([
                Buffer.from([0x70]),
                Buffer.from(object, 'utf-8'),
                Buffer.from([0x00]),
            ]);
        } else if (typeof object === 'object' && object instanceof Array || object instanceof Set) {
            const objects = [];

            for (let element of object as any[]) {
                objects.push(this.packObject(element, depth + 1));
            }

            return Buffer.concat([
                Buffer.from([0xa0]),
                ...objects,
                Buffer.from([0x00]),
            ]);
        } else if (typeof object === 'object' && object instanceof Map) {
            const objects = [];

            for (let [key, value] of object.entries() as unknown as [any, any][]) {
                objects.push(this.packObject(key, depth + 1));
                objects.push(this.packObject(value, depth + 1));
            }

            return Buffer.concat([
                Buffer.from([0xd0]),
                ...objects,
                Buffer.from([0x00]),
            ]);
        } else if (typeof object === 'object') {
            const objects = [];

            for (let key in object) {
                if (!object.hasOwnProperty(key)) continue;

                objects.push(this.packObject(key, depth + 1));
                objects.push(this.packObject(object[key], depth + 1));
            }

            return Buffer.concat([
                Buffer.from([0xd0]),
                ...objects,
                Buffer.from([0x00]),
            ]);
        } else {
            throw new Error('Unsupported object');
        }
    }
}

/**
 * Parse CFL binary property lists.
 */
export class CFLBinaryPListParser {
    /**
     * Parse plist data into equivalent JavaScript built in.
     *
     * @param {string} data
     * @return {*}
     */
    static parse(data: Buffer | string) {
        if (typeof data === 'string') data = Buffer.from(data, 'binary');

        if (data.length < HEADER_SIZE + FOOTER_SIZE + 1) {
            throw new Error('Not enough data to parse');
        }

        const header_data = data.slice(0, HEADER_SIZE).toString('binary');
        if (header_data !== HEADER_MAGIC) {
            throw new Error('Bad header magic');
        }

        const [object, remaining_data] = this.unpackObject(data.slice(HEADER_SIZE));

        if (remaining_data.length > FOOTER_SIZE) {
            throw new Error('Extra data found after unpacking root object: expected ' + FOOTER_SIZE + ' but found ' +
                remaining_data.length + ' - ' + remaining_data.toString('hex'));
        }

        if (remaining_data.toString('binary') !== FOOTER_MAGIC) {
            throw new Error('Bad footer magic');
        }

        return object;
    }

    /**
     * Unpack an object from the provided data.
     *
     * @param {Buffer} data
     * @param {number} depth
     * @return {Array}
     */
    static unpackObject(data: Buffer, depth = 1): [any, Buffer] {
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

            return [data.slice(0, size), data.slice(size)];
        } else if (object_type === 0x50) {
            // ASCII string
            throw new Error('ASCII strings not implemented');
        } else if (object_type === 0x60) {
            // Unicode string
            throw new Error('Unicode strings not implemented');
        } else if (object_type === 0x70) {
            // null terminated UTF8 string
            const size = data.indexOf(0x00);
            return [data.slice(0, size).toString('utf-8'), data.slice(size + 1)];
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

            const object: {[k: string]: any} = {};

            while (true) {
                let key: string;
                let value: any;
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
     * @param {Buffer} data
     * @return {Array}
     */
    static unpackObjectMarker(data: Buffer): [number, Buffer] {
        return [
            data.readInt8(0),
            data.slice(1),
        ];
    }

    /**
     * Unpack an int object as a JavaScript number from the provided data.
     *
     * @param {number} size_exponent
     * @param {Buffer} data
     * @return {Array}
     */
    static unpackInt(size_exponent: number, data: Buffer): [number | bigint, Buffer] {
        const int_size = 2 ** size_exponent;

        return [
            int_size === 8 ?
                data.readBigUInt64BE(0) :
                data.readUIntBE(0, int_size),
            data.slice(int_size),
        ];
    }

    /**
     * Unpack a real object as a JavaScript number from the provided data.
     *
     * @param {number} size_exponent
     * @param {Buffer} data
     * @return {Array}
     */
    static unpackReal(size_exponent: number, data: Buffer): [number, Buffer] {
        const real_size = 2 ** size_exponent;
        const real_bytes = data.slice(0, real_size);
        data = data.slice(real_size);

        if (real_size === 4) {
            return [real_bytes.readFloatBE(0), data];
        } else if (real_size === 8) {
            return [real_bytes.readDoubleBE(0), data];
        }

        throw new Error('Unsupported real packed object size of ' + real_size + ' bytes');
    }

    /**
     * Unpack count from object info nibble and/or packed int value.
     *
     * @param {number} object_info
     * @param {Buffer} data
     * @return {Array}
     */
    static unpackCount(object_info: number, data: Buffer): [number, Buffer] {
        if (object_info === 0x0f) {
            // Count is the following packed int object

            let marker;
            [marker, data] = this.unpackObjectMarker(data);

            const count_object_type = marker & 0xf0;
            const count_object_info = marker & 0x0f;

            if (count_object_type !== 0x10) {
                throw new Error('Expected count to be a packed int object');
            }

            let count;
            [count, data] = this.unpackInt(count_object_info, data);

            if (typeof count === 'bigint') throw new Error('count is a BigInt??');
            return [count, data];
        }

        return [object_info, data];
    }
}
