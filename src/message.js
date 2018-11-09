
/**
 * ACP message composition and parsing
 */

import {generateACPKeystream} from './keystream';
import adler32 from 'adler32';

/**
 * Encrypt password for ACP message header key field.
 * Truncates the password at 0x20 bytes, not sure if this is the right thing to use in all cases.
 * @param {String} password Base station password
 * @return {String} Encrypted password of proper length for the header field
 */
export function generateACPHeaderKey(password) {
    const passwordLength = 0x20;
    const passwordKey = generateACPKeystream(passwordLength);

    const passwordBuffer = password.substr(0, passwordLength).padEnd(passwordLength, '\x00');
    let encryptedPasswordBuffer = '';
    for (let i = 0; i < passwordLength; i++) {
        encryptedPasswordBuffer += String.fromCharCode(passwordKey.charCodeAt(i) ^ passwordBuffer.charCodeAt(i));
    }

    return encryptedPasswordBuffer;
}

export const headerMagic = 'acpp';
export const headerSize = 128;

export default class Message {
    constructor(version, flags, unused, command, errorCode, key, body, bodySize) {
        this.version = version;
        this.flags = flags;
        this.unused = unused;
        this.command = command;
        this.errorCode = errorCode;

        if (typeof body === 'undefined') {
            this.bodySize = typeof bodySize !== 'undefined' ? bodySize : -1;
            this.bodyChecksum = 1;
        } else {
            this.bodySize = typeof bodySize !== 'undefined' ? bodySize : body.length;
            this.bodyChecksum = adler32.sum(Buffer.from(body, 'binary'));
        }

        this.key = key;
        this.body = body;
    }

    toString() {
        let s
            = 'ACP message:\n'
            + 'Body checksum: ' + this.bodyChecksum
            + 'Body size:     ' + this.bodySize
            + 'Flags:         ' + this.flags
            + 'Unused:        ' + this.unused
            + 'Command:       ' + this.command
            + 'Error code:    ' + this.errorCode
            + 'Key:           ' + this.key;
        return s;
    }

    static unpackHeader(header_data) {
        if (header_data.length !== headerSize) throw new Error('Header data must be 128 characters');

        const buffer = Buffer.from(header_data, 'binary');

        const magic = buffer.slice(0, 4).toString();
        const version = buffer.readInt32BE(4);
        const header_checksum = buffer.readUInt32BE(8);
        const body_checksum = buffer.readInt32BE(12);
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

    static packHeader(header_data) {
        const {magic, version, header_checksum, body_checksum, body_size, flags, unused, command, error_code, key, pad1 = '', pad2 = ''} = header_data;
        const buffer = Buffer.alloc(128);

        buffer.write(magic, 0, 4);
        buffer.writeInt32BE(version, 4);
        buffer.writeInt32BE(header_checksum, 8);
        buffer.writeInt32BE(body_checksum, 12);
        buffer.writeInt32BE(body_size, 16);
        buffer.writeInt32BE(flags, 20);
        buffer.writeInt32BE(unused, 24);
        buffer.writeInt32BE(command, 28);
        buffer.writeInt32BE(error_code, 32);
        buffer.write(pad1 || ''.padEnd(12, '\u0000'), 36, 36 + 12, 'binary');
        buffer.write(key, 48, 48 + 32, 'binary');
        buffer.write(pad2 || ''.padEnd(48, '\u0000'), 80, 80 + 48, 'binary');

        const packed = buffer.toString('binary');
        console.log('Packed', packed);
        return packed;
    }

    static async parseRaw(data) {
        if (headerSize > data.length) {
            throw new Error(`Need to pass at least ${headerSize} bytes`);
        }

        const header_data = data.substr(0, headerSize);
        const body_data = data.length > headerSize ? data.substr(headerSize) : undefined;

        const {magic, version, header_checksum, body_checksum, body_size, flags, unused, command, error_code, key, pad1, pad2} = this.unpackHeader(header_data);

        if (magic !== headerMagic) {
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

        const expectedHeaderChecksum = adler32.sum(Buffer.from(tmphdr, 'binary'));
        if (header_checksum !== expectedHeaderChecksum) {
            throw new Error('Header checksum does not match');
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

        return new Message(version, flags, unused, command, error_code, key, body_data, body_size);
    }

    static composeEchoCommand(flags, password, payload) {
        const message = new Message(0x00030001, flags, 0, 1, 0, generateACPHeaderKey(password), payload);
        return message.composeRawPacket();
    }

    static composeFlashPrimaryCommand(flags, password, payload) {
        const message = new Message(0x00030001, flags, 0, 3, 0, generateACPHeaderKey(password), payload);
        return message.composeRawPacket();
    }

    static composeFlashSecondaryCommand(flags, password, payload) {
        const message = new Message(0x00030001, flags, 0, 5, 0, generateACPHeaderKey(password), payload);
        return message.composeRawPacket();
    }

    static composeFlashBootloaderCommand(flags, password, payload) {
        const message = new Message(0x00030001, flags, 0, 6, 0, generateACPHeaderKey(password), payload);
        return message.composeRawPacket();
    }

    static composeGetPropCommand(flags, password, payload) {
        const message = new Message(0x00030001, flags, 0, 0x14, 0, generateACPHeaderKey(password), payload);
        return message.composeRawPacket();
    }

    static composeSetPropCommand(flags, password, payload) {
        const message = new Message(0x00030001, flags, 0, 0x15, 0, generateACPHeaderKey(password), payload);
        return message.composeRawPacket();
    }

    static composePerformCommand(flags, password, payload) {
        const message = new Message(0x00030001, flags, 0, 0x16, 0, generateACPHeaderKey(password), payload);
        return message.composeRawPacket();
    }

    static composeMonitorCommand(flags, password, payload) {
        const message = new Message(0x00030001, flags, 0, 0x18, 0, generateACPHeaderKey(password), payload);
        return message.composeRawPacket();
    }

    static composeRPCCommand(flags, password, payload) {
        const message = new Message(0x00030001, flags, 0, 0x19, 0, generateACPHeaderKey(password), payload);
        return message.composeRawPacket();
    }

    static composeAuthCommand(flags, payload) {
        const message = new Message(0x00030001, flags, 0, 0x1a, 0, generateACPHeaderKey(''), payload);
        return message.composeRawPacket();
    }

    static composeFeatCommand(flags, payload) {
        const message = new Message(0x00030001, flags, 0, 0x1b, 0, generateACPHeaderKey(''), payload);
        return message.composeRawPacket();
    }

    static composeMessageEx(cls, version, flags, unused, command, errorCode, password, payload, payloadSize) {
        const message = new Message(version, flags, unused, command, errorCode, generateACPHeaderKey(password), payload, payloadSize);
        return message.composeRawPacket();
    }

    composeRawPacket() {
        let reply = this.composeHeader();

        if (this.body) reply += this.body;

        return reply;
    }

    composeHeader() {
        const tmphdr = this.constructor.packHeader({
            magic: headerMagic, version: this.version,
            header_checksum: 0, body_checksum: this.bodyChecksum, body_size: this.bodySize,
            flags: this.flags, unused: this.unused, command: this.command, error_code: this.errorCode, key: this.key,
        });

        const header = this.constructor.packHeader({
            magic: headerMagic, version: this.version,
            header_checksum: adler32.sum(Buffer.from(tmphdr, 'binary')),
            body_checksum: this.bodyChecksum, body_size: this.bodySize,
            flags: this.flags, unused: this.unused, command: this.command, error_code: this.errorCode, key: this.key,
        });

        return header;
    }

    static get headerMagic() {
        return headerMagic;
    }

    static get headerSize() {
        return headerSize;
    }
}
