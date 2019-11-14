
/**
 * ACP message composition and parsing
 */

import {generateACPKeystream} from './keystream';

import adler32 from 'adler32';

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
    key: string;
    pad1?: string;
    pad2?: string;
}

/**
 * Encrypt password for ACP message header key field.
 * Truncates the password at 0x20 bytes, not sure if this is the right thing to use in all cases.
 *
 * @param {string} password Base station password
 * @return {string} Encrypted password of proper length for the header field
 */
export function generateACPHeaderKey(password: string) {
    const password_length = 0x20;
    const password_key = generateACPKeystream(password_length);

    const password_buffer = password.substr(0, password_length).padEnd(password_length, '\x00');
    let encrypted_password_buffer = '';

    for (let i = 0; i < password_length; i++) {
        encrypted_password_buffer += String.fromCharCode(password_key.charCodeAt(i) ^ password_buffer.charCodeAt(i));
    }

    return encrypted_password_buffer;
}

export const HEADER_MAGIC = 'acpp';
export const HEADER_SIZE = 128;

class Message {
    readonly version: number;
    readonly flags: number;
    readonly unused: number;
    readonly command: number;
    readonly error_code: number;
    readonly key: string;
    readonly body: string | undefined;
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
     * @param {string} key
     * @param {string} body
     * @param {number} body_size
     */
    constructor(version: number, flags: number, unused: number, command: number, error_code: number, key: string, body?: string, body_size?: number) {
        this.version = version;
        this.flags = flags;
        this.unused = unused;
        this.command = command;
        this.error_code = error_code;

        if (typeof body === 'undefined') {
            this.body_size = typeof body_size !== 'undefined' ? body_size : -1;
            this.body_checksum = 1;
        } else {
            this.body_size = typeof body_size !== 'undefined' ? body_size : body.length;
            this.body_checksum = adler32.sum(Buffer.from(body, 'binary'));
        }

        this.key = key;
        this.body = body;
    }

    toString() {
        return 'ACP message:\n'
            + 'Body checksum: ' + this.body_checksum
            + 'Body size:     ' + this.body_size
            + 'Flags:         ' + this.flags
            + 'Unused:        ' + this.unused
            + 'Command:       ' + this.command
            + 'Error code:    ' + this.error_code
            + 'Key:           ' + this.key;
    }

    /**
     * Unpacks an ACP message header.
     *
     * @param {string} header_data
     * @return {object}
     */
    static unpackHeader(header_data: string): HeaderData {
        if (header_data.length !== HEADER_SIZE) {
            throw new Error('Header data must be 128 bytes');
        }

        const buffer = Buffer.from(header_data, 'binary');

        const magic = buffer.slice(0, 4).toString();
        const version = buffer.readInt32BE(4);
        const header_checksum = buffer.readUInt32BE(8);
        const body_checksum = buffer.readUInt32BE(12);
        const body_size = buffer.readInt32BE(16);
        const flags = buffer.readInt32BE(20);
        const unused = buffer.readInt32BE(24);
        const command = buffer.readInt32BE(28);
        const error_code = buffer.readInt32BE(32);
        const pad1 = buffer.slice(36, 36 + 12).toString('binary');
        const key = buffer.slice(48, 48 + 32).toString('binary');
        const pad2 = buffer.slice(80, 80 + 48).toString('binary');

        return {magic, version, header_checksum, body_checksum, body_size, flags, unused, command, error_code, key, pad1, pad2};
    }

    /**
     * Packs an ACP message header.
     *
     * @param {object} header_data
     * @return {string}
     */
    static packHeader(header_data: HeaderData) {
        const {magic, version, header_checksum, body_checksum, body_size, flags, unused, command, error_code, key, pad1 = '', pad2 = ''} = header_data;
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
        buffer.write(pad1 || ''.padEnd(12, '\u0000'), 36, 36 + 12, 'binary');
        buffer.write(key, 48, 48 + 32, 'binary');
        buffer.write(pad2 || ''.padEnd(48, '\u0000'), 80, 80 + 48, 'binary');

        return buffer.toString('binary');
    }

    /**
     * Parses a full ACP message.
     *
     * @param {string} data
     * @param {boolean} return_remaining Whether to return any additional data
     * @return {Message|Array}
     */
    static parseRaw(data: string, return_remaining: true): [Message, string]
    static parseRaw(data: string, return_remaining?: boolean): Message
    static parseRaw(data: string, return_remaining = false): [Message, string] | Message {
        if (data.length < HEADER_SIZE) {
            throw new Error(`Need to pass at least ${HEADER_SIZE} bytes`);
        }

        const header_data = data.substr(0, HEADER_SIZE);
        let body_data = data.length > HEADER_SIZE ? data.substr(HEADER_SIZE) : undefined;

        const {magic, version, header_checksum, body_checksum, body_size, flags, unused, command, error_code, key, pad1, pad2} = this.unpackHeader(header_data);

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

        const expected_header_checksum = adler32.sum(Buffer.from(tmphdr, 'binary'));
        if (header_checksum !== expected_header_checksum) {
            throw new Error('Header checksum does not match');
        }

        if (body_data && return_remaining) {
            body_data = body_data.substr(0, body_size);
        }

        if (body_data && body_size === -1) {
            throw new Error('Cannot handle stream header with data attached');
        }

        if (body_data && body_size !== body_data.length) {
            throw new Error('Message body size does not match available data');
        }

        if (body_data && body_checksum !== adler32.sum(Buffer.from(body_data, 'binary'))) {
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

        if (return_remaining) return [message, data.substr(HEADER_SIZE + body_size)];

        return message;
    }

    static composeEchoCommand(flags: number, password: string, payload?: string) {
        return new Message(0x00030001, flags, 0, 1, 0, generateACPHeaderKey(password), payload);
    }

    static composeFlashPrimaryCommand(flags: number, password: string, payload?: string) {
        return new Message(0x00030001, flags, 0, 3, 0, generateACPHeaderKey(password), payload);
    }

    static composeFlashSecondaryCommand(flags: number, password: string, payload?: string) {
        return new Message(0x00030001, flags, 0, 5, 0, generateACPHeaderKey(password), payload);
    }

    static composeFlashBootloaderCommand(flags: number, password: string, payload?: string) {
        return new Message(0x00030001, flags, 0, 6, 0, generateACPHeaderKey(password), payload);
    }

    static composeGetPropCommand(flags: number, password: string, payload?: string) {
        return new Message(0x00030001, flags, 0, 0x14, 0, generateACPHeaderKey(password), payload);
    }

    static composeSetPropCommand(flags: number, password: string, payload?: string) {
        return new Message(0x00030001, flags, 0, 0x15, 0, generateACPHeaderKey(password), payload);
    }

    static composePerformCommand(flags: number, password: string, payload?: string) {
        return new Message(0x00030001, flags, 0, 0x16, 0, generateACPHeaderKey(password), payload);
    }

    static composeMonitorCommand(flags: number, password: string, payload?: string) {
        return new Message(0x00030001, flags, 0, 0x18, 0, generateACPHeaderKey(password), payload);
    }

    static composeRPCCommand(flags: number, password: string, payload?: string) {
        return new Message(0x00030001, flags, 0, 0x19, 0, generateACPHeaderKey(password), payload);
    }

    static composeAuthCommand(flags: number, payload?: string) {
        return new Message(0x00030001, flags, 0, 0x1a, 0, generateACPHeaderKey(''), payload);
    }

    static composeFeatCommand(flags: number, payload?: string) {
        return new Message(0x00030001, flags, 0, 0x1b, 0, generateACPHeaderKey(''), payload);
    }

    static composeMessageEx(version: number, flags: number, unused: number, command: number, error_code: number, password: string, payload?: string, payload_size?: number) {
        return new Message(version, flags, unused, command, error_code, generateACPHeaderKey(password), payload, payload_size);
    }

    /**
     * Composes a full ACP message.
     *
     * @return {string}
     */
    composeRawPacket() {
        let reply = this.composeHeader();

        if (this.body) reply += this.body;

        return reply;
    }

    /**
     * Composes an ACP message header.
     *
     * @param {number} size
     * @param {number} timeout
     * @return {Promise<string>}
     */
    composeHeader() {
        const tmphdr = this.constructor.packHeader({
            magic: HEADER_MAGIC, version: this.version,
            header_checksum: 0, body_checksum: this.body_checksum, body_size: this.body_size,
            flags: this.flags, unused: this.unused, command: this.command, error_code: this.error_code, key: this.key,
        });

        const header = this.constructor.packHeader({
            magic: HEADER_MAGIC, version: this.version,
            header_checksum: adler32.sum(Buffer.from(tmphdr, 'binary')),
            body_checksum: this.body_checksum, body_size: this.body_size,
            flags: this.flags, unused: this.unused, command: this.command, error_code: this.error_code, key: this.key,
        });

        return header;
    }

    static get HEADER_MAGIC() {
        return HEADER_MAGIC;
    }

    static get HEADER_SIZE() {
        return HEADER_SIZE;
    }
}

interface Message {
    constructor: typeof Message;
}

export default Message;
