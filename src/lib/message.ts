
/**
 * ACP message composition and parsing
 */

import {generateACPKeystream} from './keystream';

import * as adler32 from 'adler32';

interface HeaderData {
    magic: string;
    version: number;
    header_checksum: number;
    body_checksum: number;
    body_size: number;
    flags: number;
    unused: number;
    command: number;
    error_code: number;
    key: Buffer;
    pad1?: Buffer;
    pad2?: Buffer;
}

/**
 * Encrypt password for ACP message header key field.
 *
 * Truncates the password at 0x20 bytes, not sure if this is the right thing to use in all cases.
 *
 * @param {string} password Base station password
 * @return {Buffer} Encrypted password of proper length for the header field
 */
export function generateACPHeaderKey(password: string) {
    const password_length = 0x20;
    const password_key = generateACPKeystream(password_length);

    const password_buffer = password.substr(0, password_length).padEnd(password_length, '\x00');
    const encrypted_password_buffer = Buffer.alloc(password_length);

    for (let i = 0; i < password_length; i++) {
        encrypted_password_buffer[i] = password_key[i] ^ password_buffer.charCodeAt(i);
    }

    return encrypted_password_buffer;
}

export const HEADER_MAGIC = 'acpp';
export const HEADER_SIZE = 128;

export enum MessageType {
    ECHO = 0x00000001,
    FLASH_PRIMARY = 0x00000003,
    FLASH_SECONDARY = 0x00000005,
    FLASH_BOOTLOADER = 0x00000006,
    GET_PROPERTY = 0x00000014,
    SET_PROPERTY = 0x00000015,
    PERFORM = 0x00000016,
    MONITOR = 0x00000018,
    RPC = 0x00000019,
    AUTHENTICATE = 0x0000001a,
    GET_FEATURES = 0x0000001b,
}

export enum ErrorCode {
    /** No error */
    SUCCESS = 0,

    // Get property
    NOT_AVAILABLE = -10, // 0xfffffff6
    INVALID_KEY = -16,
    UNKNOWN_FFFFE58C = -6772, // 0xffffe58c - returned from raNm

    // Authenticate
    INCORRECT_PASSWORD = -6754,
}

/**
 * Represents an ACP message.
 */
export default class Message {
    readonly version: number;
    readonly flags: number;
    readonly unused: number;
    readonly command: MessageType;
    readonly error_code: ErrorCode;
    readonly key: Buffer;
    readonly body?: Buffer;
    readonly body_size: number;
    readonly body_checksum: number;

    /**
     * Creates a Message.
     *
     * @param {number} version
     * @param {number} flags
     * @param {number} unused
     * @param {number} command
     * @param {number} error_code
     * @param {Buffer} key
     * @param {Buffer} body
     * @param {number} body_size
     */
    constructor(
        version: number, flags: number, unused: number, command: MessageType, error_code: ErrorCode,
        key: Buffer | string, body?: Buffer | string, body_size?: number
    ) {
        if (typeof body === 'string') body = Buffer.from(body, 'binary');

        this.version = version;
        this.flags = flags;
        this.unused = unused;
        this.command = command;
        this.error_code = error_code;

        if (body instanceof Buffer || typeof body === 'string') {
            this.body_size = typeof body_size !== 'undefined' ? body_size : body.length;
            this.body_checksum = adler32.sum(body);
        } else {
            this.body_size = typeof body_size !== 'undefined' ? body_size : -1;
            this.body_checksum = 1;
        }

        this.key = key instanceof Buffer ? key : Buffer.from(key, 'binary');
        this.body = body;

        if (this.key.length !== 32) {
            throw new Error('key must be a 32-byte Buffer or string');
        }
    }

    /**
     * Returns the message in a readable format.
     *
     * @return {string}
     */
    toString() {
        return 'ACP message:' +
            '\nBody checksum: ' + this.body_checksum +
            '\nBody size:     ' + this.body_size +
            '\nFlags:         ' + this.flags +
            '\nUnused:        ' + this.unused +
            '\nCommand:       ' + this.command + ' (' + MessageType[this.command] + ')' +
            '\nError code:    ' + this.error_code +
                (this.error_code !== 0 ? ' (' + ErrorCode[this.error_code] + ')' : '') +
            '\nKey:           ' + this.key;
    }

    /**
     * Unpacks an ACP message header.
     *
     * @param {Buffer|string} data
     * @return {object}
     */
    static unpackHeader(data: Buffer | string): HeaderData {
        if (typeof data === 'string') data = Buffer.from(data, 'binary');

        if (data.length !== HEADER_SIZE) {
            throw new Error('Header data must be 128 bytes');
        }

        const magic = data.slice(0, 4).toString();
        const version = data.readInt32BE(4);
        const header_checksum = data.readUInt32BE(8);
        const body_checksum = data.readUInt32BE(12);
        const body_size = data.readInt32BE(16);
        const flags = data.readInt32BE(20);
        const unused = data.readInt32BE(24);
        const command = data.readInt32BE(28);
        const error_code = data.readInt32BE(32);
        const pad1 = data.slice(36, 36 + 12);
        const key = data.slice(48, 48 + 32);
        const pad2 = data.slice(80, 80 + 48);

        return {
            magic, version, header_checksum, body_checksum, body_size, flags, unused, command, error_code,
            key, pad1, pad2,
        };
    }

    /**
     * Packs an ACP message header.
     *
     * @param {object} header_data
     * @return {string}
     */
    static packHeader(header_data: HeaderData) {
        const {
            magic, version, header_checksum, body_checksum, body_size, flags, unused, command, error_code,
            key, pad1 = '', pad2 = '',
        } = header_data;
        const buffer = Buffer.alloc(128);

        buffer.write(magic, 0, 4);
        buffer.writeInt32BE(version, 4);
        buffer.writeUInt32BE(header_checksum, 8);
        buffer.writeUInt32BE(body_checksum, 12);
        buffer.writeInt32BE(body_size, 16);
        buffer.writeInt32BE(flags, 20);
        buffer.writeInt32BE(unused, 24);
        buffer.writeInt32BE(command, 28);
        buffer.writeInt32BE(error_code, 32);
        buffer.write(pad1 instanceof Buffer ? pad1.toString('binary') : pad1 || ''.padEnd(12, '\u0000'),
            36, 36 + 12, 'binary');
        buffer.write(key instanceof Buffer ? key.toString('binary') : key, 48, 48 + 32, 'binary');
        buffer.write(pad2 instanceof Buffer ? pad2.toString('binary') : pad2 || ''.padEnd(48, '\u0000'),
            80, 80 + 48, 'binary');

        return buffer;
    }

    /**
     * Parses a full ACP message.
     *
     * @param {string} data
     * @param {boolean} return_remaining Whether to return any additional data
     * @return {Message|Array}
     */
    static parseRaw(data: Buffer | string, return_remaining: true): [Message, Buffer]
    static parseRaw(data: Buffer | string, return_remaining: false): Message
    static parseRaw(data: Buffer | string, return_remaining: boolean): [Message, Buffer] | Message
    static parseRaw(data: Buffer | string): Message
    // eslint-disable-next-line require-jsdoc
    static parseRaw(data: Buffer | string, return_remaining = false): [Message, Buffer] | Message {
        if (typeof data === 'string') data = Buffer.from(data, 'binary');

        if (data.length < HEADER_SIZE) {
            throw new Error(`Need to pass at least ${HEADER_SIZE} bytes`);
        }

        const header_data = data.slice(0, HEADER_SIZE);
        let body_data = data.length > HEADER_SIZE ? data.slice(HEADER_SIZE) : undefined;

        const {
            magic, version, header_checksum, body_checksum, body_size, flags, unused, command, error_code,
            key, pad1, pad2,
        } = this.unpackHeader(header_data);

        if (magic !== HEADER_MAGIC) {
            throw new Error('Bad header magic');
        }

        const versions = [0x00000001, 0x00030001];
        if (!versions.includes(version)) {
            throw new Error('Unknown version ' + version);
        }

        const tmphdr = this.packHeader({
            magic, version,
            header_checksum: 0, body_checksum, body_size,
            flags, unused, command, error_code, key,
            pad1, pad2,
        });

        const expected_header_checksum = adler32.sum(tmphdr);
        if (header_checksum !== expected_header_checksum) {
            throw new Error('Header checksum does not match');
        }

        if (body_data && return_remaining) {
            body_data = body_data.slice(0, body_size);
        }

        if (body_data && body_size === -1) {
            throw new Error('Cannot handle stream header with data attached');
        }

        if (body_data && body_size !== body_data.length) {
            throw new Error('Message body size does not match available data');
        }

        if (body_data && body_checksum !== adler32.sum(body_data)) {
            throw new Error('Body checksum does not match');
        }

        // TODO: check flags
        // TODO: check status

        const commands = [1, 3, 4, 5, 6, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b];
        if (!commands.includes(command)) {
            throw new Error('Unknown command ' + command);
        }

        // TODO: check error code

        const message = new Message(version, flags, unused, command, error_code, key, body_data, body_size);

        if (return_remaining) return [message, data.slice(HEADER_SIZE + (body_data ? body_data.length : 0))];

        return message;
    }

    // eslint-disable-next-line require-jsdoc
    static composeEchoCommand(flags: number, password: string | null, payload?: Buffer | string) {
        const key = password ? generateACPHeaderKey(password) : Buffer.alloc(32);
        return new Message(0x00030001, flags, 0, MessageType.ECHO, 0, key, payload);
    }

    // eslint-disable-next-line require-jsdoc
    static composeFlashPrimaryCommand(flags: number, password: string | null, payload?: Buffer | string) {
        const key = password ? generateACPHeaderKey(password) : Buffer.alloc(32);
        return new Message(0x00030001, flags, 0, MessageType.FLASH_PRIMARY, 0, key, payload);
    }

    // eslint-disable-next-line require-jsdoc
    static composeFlashSecondaryCommand(flags: number, password: string | null, payload?: Buffer | string) {
        const key = password ? generateACPHeaderKey(password) : Buffer.alloc(32);
        return new Message(0x00030001, flags, 0, MessageType.FLASH_SECONDARY, 0, key, payload);
    }

    // eslint-disable-next-line require-jsdoc
    static composeFlashBootloaderCommand(flags: number, password: string | null, payload?: Buffer | string) {
        const key = password ? generateACPHeaderKey(password) : Buffer.alloc(32);
        return new Message(0x00030001, flags, 0, MessageType.FLASH_BOOTLOADER, 0, key, payload);
    }

    // eslint-disable-next-line require-jsdoc
    static composeGetPropCommand(flags: number, password: string | null, payload?: Buffer | string) {
        const key = password ? generateACPHeaderKey(password) : Buffer.alloc(32);
        return new Message(0x00030001, flags, 0, MessageType.GET_PROPERTY, 0, key, payload);
    }

    // eslint-disable-next-line require-jsdoc
    static composeSetPropCommand(flags: number, password: string | null, payload?: Buffer | string) {
        const key = password ? generateACPHeaderKey(password) : Buffer.alloc(32);
        return new Message(0x00030001, flags, 0, MessageType.SET_PROPERTY, 0, key, payload);
    }

    // eslint-disable-next-line require-jsdoc
    static composePerformCommand(flags: number, password: string | null, payload?: Buffer | string) {
        const key = password ? generateACPHeaderKey(password) : Buffer.alloc(32);
        return new Message(0x00030001, flags, 0, MessageType.PERFORM, 0, key, payload);
    }

    // eslint-disable-next-line require-jsdoc
    static composeMonitorCommand(flags: number, password: string | null, payload?: Buffer | string) {
        const key = password ? generateACPHeaderKey(password) : Buffer.alloc(32);
        return new Message(0x00030001, flags, 0, MessageType.MONITOR, 0, key, payload);
    }

    // eslint-disable-next-line require-jsdoc
    static composeRPCCommand(flags: number, password: string | null, payload?: Buffer | string) {
        const key = password ? generateACPHeaderKey(password) : Buffer.alloc(32);
        return new Message(0x00030001, flags, 0, MessageType.RPC, 0, key, payload);
    }

    // eslint-disable-next-line require-jsdoc
    static composeAuthCommand(flags: number, payload?: Buffer | string) {
        return new Message(0x00030001, flags, 0, MessageType.AUTHENTICATE, 0, generateACPHeaderKey(''), payload);
    }

    // eslint-disable-next-line require-jsdoc
    static composeFeatCommand(flags: number, payload?: Buffer | string) {
        return new Message(0x00030001, flags, 0, MessageType.GET_FEATURES, 0, generateACPHeaderKey(''), payload);
    }

    // eslint-disable-next-line require-jsdoc
    static composeMessageEx(
        version: number, flags: number, unused: number, command: number, error_code: number, password: string | null,
        payload?: Buffer | string, payload_size?: number
    ) {
        const key = password ? generateACPHeaderKey(password) : Buffer.alloc(32);
        return new Message(version, flags, unused, command, error_code, key, payload, payload_size);
    }

    /**
     * Composes a full ACP message.
     *
     * @return {Buffer}
     */
    composeRawPacket() {
        const header = this.composeHeader();

        if (this.body) return Buffer.concat([header, this.body]);

        return header;
    }

    /**
     * Composes an ACP message header.
     *
     * @param {number} size
     * @param {number} timeout
     * @return {Buffer}
     */
    composeHeader() {
        const tmphdr = this.constructor.packHeader({
            magic: HEADER_MAGIC, version: this.version,
            header_checksum: 0, body_checksum: this.body_checksum, body_size: this.body_size,
            flags: this.flags, unused: this.unused, command: this.command, error_code: this.error_code, key: this.key,
        });

        const header = this.constructor.packHeader({
            magic: HEADER_MAGIC, version: this.version,
            header_checksum: adler32.sum(tmphdr),
            body_checksum: this.body_checksum, body_size: this.body_size,
            flags: this.flags, unused: this.unused, command: this.command, error_code: this.error_code, key: this.key,
        });

        return header;
    }

    /** @type {string} */
    static get HEADER_MAGIC() {
        return HEADER_MAGIC;
    }

    /** @type {number} */
    static get HEADER_SIZE() {
        return HEADER_SIZE;
    }
}

export default interface Message {
    constructor: typeof Message;
} // eslint-disable-line semi
