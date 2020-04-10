
import * as stream from 'stream';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import * as adler32 from 'adler32';
import {LogLevel, loglevel} from '..';

const keys: {
    [model: number]: Buffer;
} = {
    107: Buffer.from('5249c351028bf1fd2bd1849e28b23f24', 'hex'),
    108: Buffer.from('bb7deb0970d8ee2e00fa46cb1c3c098e', 'hex'),
    115: Buffer.from('1075e806f4770cd4763bd285a64e9174', 'hex'),
    120: Buffer.from('688cdd3b1b6bdda207b6cec2735292d2', 'hex'),
};

/**
 * Get the firmware decryption key for an AirPort base station model.
 *
 * @param {number} model
 * @return {Buffer}
 */
export function deriveKey(model: keyof typeof keys) {
    if (!keys[model]) throw new Error('Unknown model');

    const key = keys[model];
    const derived_key = Buffer.alloc(key.length);

    for (let i = 0; i < key.length; i++) {
        derived_key[i] = key[i] ^ (i + 0x19);
    }

    return derived_key;
}

export interface HeaderData {
    magic: string;
    byte_0x0f: number;
    model: number;
    version: number;
    byte_0x18: number;
    byte_0x19: number;
    byte_0x1a: number;
    flags: number;
    unknown_0x1c: number;
}

export const HEADER_MAGIC = 'APPLE-FIRMWARE\x00';
export const HEADER_SIZE = 32;

/**
 * Decrypts the firmware image from a firmware file.
 *
 * If a firmware file is passed in a Buffer, the decrypted firmware image will be returned in a Buffer.
 * Otherwise, a transform stream will be returned.
 *
 * @param {Buffer} [data]
 * @return {Buffer|stream.Transform}
 */
export function parse(data: Buffer): Buffer
export function parse(): stream.Transform
// eslint-disable-next-line require-jsdoc
export function parse(data?: Buffer) {
    if (data instanceof Buffer) {
        if (data.length < HEADER_SIZE + 4) throw new Error('Not enough data to parse');

        const header_data = data.slice(0, HEADER_SIZE);
        const inner_data = data.slice(HEADER_SIZE, data.length - 4);
        const stored_checksum = data.readUInt32BE(data.length - 4);

        // eslint-disable-next-line no-unused-vars
        const {byte_0x0f, model, version, byte_0x18, byte_0x1a, flags, unknown_0x1c} = parseHeader(header_data);

        const decrypted_data = flags & 2 ? decrypt(inner_data, model, byte_0x0f) : inner_data;

        const checksum = adler32.sum(Buffer.concat([header_data, decrypted_data]));
        if (loglevel >= LogLevel.INFO) {
            console.debug('Stored checksum      %d %s', stored_checksum, stored_checksum.toString(16));
            console.debug('Calculared checksum  %d %s', checksum, checksum.toString(16));
            console.debug('Length               %d %s', header_data.length + decrypted_data.length,
                (header_data.length + decrypted_data.length).toString(16));
        }
        if (checksum !== stored_checksum) throw new Error('Bad checksum');

        return decrypted_data;
    } else {
        let header_data = Buffer.alloc(0);
        let header: HeaderData | null = null;
        let decrypt_stream: stream.Transform | null = null;
        let last_data = Buffer.alloc(0);
        let checksum: number = 1;
        let length = 0;

        return new stream.Transform({
            transform(chunk: Buffer | string, encoding: BufferEncoding, callback) {
                if (typeof chunk === 'string') chunk = Buffer.from(chunk, encoding);
                if (!chunk.length) return callback();

                if (header_data.length < HEADER_SIZE) {
                    [header_data, chunk] = [
                        Buffer.concat([
                            header_data,
                            chunk.slice(0, Math.min(chunk.length, HEADER_SIZE - header_data.length)),
                        ]),
                        chunk.slice(Math.min(chunk.length, HEADER_SIZE - header_data.length)),
                    ];
                }
                if (!header && header_data.length === HEADER_SIZE) {
                    checksum = adler32.sum(header_data, checksum);
                    const {byte_0x0f, model, flags} = header = parseHeader(header_data);
                    this.emit('header', header);
                    decrypt_stream = flags & 2 ? decrypt(model, byte_0x0f) : new stream.PassThrough();
                    decrypt_stream.on('data', decrypted => {
                        this.push(decrypted);
                        checksum = adler32.sum(decrypted, checksum);
                        length += decrypted.length;
                    });
                }

                if (decrypt_stream && chunk.length) {
                    const data = Buffer.concat([last_data, chunk]);
                    [chunk, last_data] = [
                        data.slice(0, Math.max(-4, -data.length)),
                        data.slice(Math.max(-4, -data.length)),
                    ];
                    decrypt_stream.write(chunk, callback);
                } else callback();
            },
            flush(callback) {
                if (last_data.length !== 4 || !decrypt_stream) {
                    const error = new Error('Not enough data to parse');
                    if (decrypt_stream) decrypt_stream.destroy(error);
                    return callback(error);
                }

                const stored_checksum = last_data.readUInt32BE(0);

                decrypt_stream.end(() => {
                    if (loglevel >= LogLevel.INFO) {
                        console.debug('Stored checksum      %d %s', stored_checksum, stored_checksum.toString(16));
                        console.debug('Calculared checksum  %d %s', checksum, checksum.toString(16));
                        console.debug('Length               %d %s', header_data.length + length,
                            (header_data.length + length).toString(16));
                    }
                    if (checksum !== stored_checksum) return callback(new Error('Bad checksum'));
                    callback();
                });
            },
        });
    }
}

/**
 * Parse firmware file header data.
 *
 * @param {Buffer} data
 * @return {object}
 */
export function parseHeader(data: Buffer): HeaderData {
    if (data.length !== HEADER_SIZE) throw new Error('Not enough data to parse');

    const magic = data.slice(0, 15).toString('binary');
    const byte_0x0f = data.readUInt8(15);
    const model = data.readUInt32BE(16);
    const version = data.readUInt32BE(20);
    const byte_0x18 = data.readUInt8(24);
    const byte_0x19 = data.readUInt8(25);
    const byte_0x1a = data.readUInt8(26);
    const flags = data.readUInt8(27);
    const unknown_0x1c = data.readUInt32BE(28);

    if (magic !== HEADER_MAGIC) {
        throw new Error('Invalid header');
    }

    return {magic, byte_0x0f, model, version, byte_0x18, byte_0x19, byte_0x1a, flags, unknown_0x1c};
}

/**
 * Compose firmware file header data.
 *
 * @param {object} data
 * @return {Buffer}
 */
export function composeHeader(data: HeaderData) {
    if (data.magic !== HEADER_MAGIC) {
        throw new Error('data.magic must match HEADER_MAGIC');
    }

    const buffer = Buffer.alloc(HEADER_SIZE);

    buffer.write(data.magic, 'binary');
    buffer.writeUInt8(data.byte_0x0f, 15);
    buffer.writeUInt32BE(data.model, 16);
    buffer.writeUInt32BE(data.version, 20);
    buffer.writeUInt8(data.byte_0x18, 24);
    buffer.writeUInt8(data.byte_0x19, 25);
    buffer.writeUInt8(data.byte_0x1a, 26);
    buffer.writeUInt8(data.flags, 27);
    buffer.writeUInt32BE(data.unknown_0x1c, 28);

    return buffer;
}

/**
 * Decrypts the inner firmware image from a firmware file.
 *
 * If a firmware file is passed in a Buffer, the decrypted firmware image will be returned in a Buffer.
 * Otherwise, a transform stream will be returned.
 *
 * @param {Buffer} [data]
 * @return {Buffer|stream.Transform}
 */
export function decrypt(data: Buffer, model: number, byte_0x0f: number): Buffer
export function decrypt(model: number, byte_0x0f: number): stream.Transform
// eslint-disable-next-line require-jsdoc
export function decrypt(...args: any) {
    const [model, byte_0x0f]: [number, number] = args[0] instanceof Buffer ? args.slice(1) : args;

    const iv = Buffer.from(HEADER_MAGIC + String.fromCharCode(byte_0x0f), 'binary');
    const key = deriveKey(model);
    if (loglevel >= LogLevel.DEBUG) console.debug('Derived key for model %d: %s', model, key.toString('hex'));
    const chunk_length = 0x8000;

    if (args[0] instanceof Buffer) {
        const data = args[0];
        const decrypted_data = Buffer.alloc(data.length);

        let remaining_length = data.length;
        while (remaining_length) {
            if (remaining_length > chunk_length) {
                decryptChunk(data.slice(0 - remaining_length, 0 - (remaining_length - chunk_length)), key, iv)
                    .copy(decrypted_data, data.length - remaining_length);
                remaining_length -= chunk_length;
            } else {
                decryptChunk(data.slice(0 - remaining_length), key, iv)
                    .copy(decrypted_data, data.length - remaining_length);
                remaining_length = 0;
            }
        }

        return decrypted_data;
    } else {
        let data = Buffer.alloc(0);

        return new stream.Transform({
            transform(chunk: Buffer | string, encoding: BufferEncoding, callback) {
                if (typeof chunk === 'string') chunk = Buffer.from(chunk, encoding);
                if (!chunk.length) return callback();

                data = data.length ? Buffer.concat([data, chunk]) : chunk;

                while (data.length >= chunk_length) {
                    this.push(decryptChunk(data.slice(0, chunk_length), key, iv));
                    data = data.slice(chunk_length);
                }

                callback();
            },
            flush(callback) {
                if (data.length) {
                    this.push(decryptChunk(data, key, iv));
                    data = Buffer.alloc(0);
                }

                callback();
            },
        });
    }
}

/**
 * Decrypts a 32768 byte firmware file chunk.
 *
 * @param {Buffer} data
 * @param {Buffer} key
 * @param {Buffer} iv
 * @return {Buffer}
 */
function decryptChunk(data: Buffer, key: Buffer, iv: Buffer) {
    const cipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    cipher.setAutoPadding(false);
    const decrypted = Buffer.alloc(data.length);

    let bytes_left = data.length;
    while (bytes_left) {
        if (bytes_left > 0x10) {
            cipher.update(data.slice(0 - bytes_left, 0 - (bytes_left - 0x10)))
                .copy(decrypted, data.length - bytes_left);
            bytes_left -= 0x10;
        } else if (bytes_left === 0x10) {
            cipher.update(data.slice(0 - bytes_left))
                .copy(decrypted, data.length - bytes_left);
            bytes_left = 0;
        } else {
            data.copy(decrypted, data.length - bytes_left, data.length - bytes_left);
            bytes_left = 0;
        }
    }

    return decrypted;
}

/**
 * Decompresses the decrypted inner firmware image from a firmware file.
 *
 * If a firmware image is passed in a Buffer, the decompressed firmware image will be returned in a Buffer.
 * Otherwise, a transform stream will be returned.
 *
 * @param {Buffer} [data]
 * @return {Buffer|stream.Transform}
 */
export function extract(data: Buffer): Promise<Buffer>
export function extract(): stream.Transform
// eslint-disable-next-line require-jsdoc
export function extract(data?: Buffer) {
    const header_bytes = Buffer.from('\x1f\x8b\x08', 'binary');

    if (data instanceof Buffer) {
        const gzip_offset = data.indexOf(header_bytes);
        const gzdata = data.slice(gzip_offset);

        if (loglevel >= LogLevel.INFO) {
            console.debug('Data length %d', data.length);
            console.debug('gzip offset %d', gzip_offset);
            console.debug('gzip length %d', gzdata.length);
        }

        return new Promise<Buffer>((resolve, reject) => {
            zlib.unzip(gzdata, (err, buffer) => {
                err ? reject(err) : resolve(buffer);
            });
        });
    } else {
        const gzip = zlib.createGunzip();
        let found_header = false;
        let last_data = Buffer.alloc(0);

        const decompress = new stream.Transform({
            transform(chunk: Buffer | string, encoding: BufferEncoding, callback) {
                if (typeof chunk === 'string') chunk = Buffer.from(chunk, encoding);
                if (!chunk.length) return callback();
                if (!found_header) {
                    const data = Buffer.concat([last_data, chunk]);
                    const gzip_offset = data.indexOf(header_bytes);
                    if (gzip_offset > -1) {
                        if (loglevel >= LogLevel.INFO) console.warn('Found gzip offset %d', gzip_offset);
                        chunk = data.slice(gzip_offset);
                        found_header = true;
                    } else {
                        [chunk, last_data] = [
                            data.slice(0, Math.max(-header_bytes.length, -data.length)),
                            data.slice(Math.max(-header_bytes.length, -data.length)),
                        ];
                        return callback();
                    }
                }

                gzip.write(chunk, callback);
            },
            flush(callback) {
                gzip.end(callback);
            },
        });

        gzip.on('data', (chunk: Buffer) => {
            decompress.push(chunk);
        });

        return decompress;
    }
}
