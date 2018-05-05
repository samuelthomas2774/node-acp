
/**
 * ACP message composition and parsing
 */

import { generateACPKeystream } from './keystream';
import struct from 'python-struct';
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

    const passwordBuffer = password.substr(0, passwordLength).padStart(passwordLength, '\x00');
    let encryptedPasswordBuffer = '';
    for (let i = 0; i < passwordLength; i++) {
        encryptedPasswordBuffer += String.fromCharCode(passwordKey.charCodeAt(i) ^ passwordBuffer.charCodeAt(i));
    }

    return encryptedPasswordBuffer;
}

export const headerFormat = '!4s8i12x32s48x';
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
            this.bodyChecksum = adler32.sum(body);
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

    static async parseRaw(data) {
        if (headerSize > data.length)
            throw new Error(`Need to pass at least ${headerSize} bytes`);

        const header_data = data.substr(0, headerSize);
        const body_data = data.length > headerSize ? data.substr(headerSize) : undefined;

        const unpackedData = struct.unpack(headerFormat, Buffer.from(header_data, 'binary'));

        const [magic, version, header_checksum, body_checksum, body_size, flags, unused, command, error_code, key] = unpackedData;

        console.debug('ACP message header fields (parsed not validated):', {
            magic, version, header_checksum, body_checksum, body_size, flags, unused, command, error_code, key
        });

        if (magic !== headerMagic)
            throw new Error('Bad header magic');

        const versions = [0x00000001, 0x00030001];
        if (!versions.includes(version))
            throw new Error('Unknown version ' + version);

        const tmphdr = struct.pack(headerFormat, [
            magic, version,
            /* header_checksum: */ 0, body_checksum, body_size,
            flags, unused, command, error_code, key
        ]).toString('binary');

        if (header_checksum !== adler32.sum(tmphdr))
            throw new Error('Header checksum does not match');

        if (body_data && body_size === -1)
            throw new Error('Cannot handle stream header with data attached');

        if (body_data && body_size !== body_data.length)
            throw new Error('Message body size does not match available data');

        if (body_data && body_checksum !== adler32.sum(body_data))
            throw new Error('Body checksum does not match');

        // TODO: check flags
        // TODO: check status

        const commands = [1, 3, 4, 5, 6, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b];
        if (!commands.includes(command))
            throw new Error('Unknown command ' + command);

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

    static composeAuthCommand(flags, password, payload) {
        const message = new Message(0x00030001, flags, 0, 0x1a, 0, generateACPHeaderKey(password), payload);
        return message.composeRawPacket();
    }

    static composeFeatCommand(flags, password, payload) {
        const message = new Message(0x00030001, flags, 0, 0x1b, 0, generateACPHeaderKey(password), payload);
        return message.composeRawPacket();
    }

    static composeMessageEx(cls, version, flags, unused, command, errorCode, password, payload, payloadSize) {
        const message = new Message(version, flags, unused, command, errorCode, generateACPHeaderKey(password), payload, payloadSize);
        return message.composeRawPacket();
    }

    composeRawPacket() {
        let reply = this.composeHeader();
        if (this.body)
            reply += this.body;

        return reply;
    }

    composeHeader() {
        const tmphdr = struct.pack(headerFormat, [
            headerMagic, this.version,
            0, this.bodyChecksum, this.bodySize,
            this.flags, this.unused, this.command, this.errorCode, this.key
        ]).toString('binary');

        const header = struct.pack(headerFormat, [
            headerMagic, this.version,
            adler32.sum(tmphdr), this.bodyChecksum, this.bodySize,
            this.flags, this.unused, this.command, this.errorCode, this.key
        ]).toString('binary');

        return header;
    }

    static get headerFormat() {
        return headerFormat;
    }

    static get headerMagic() {
        return headerMagic;
    }

    static get headerSize() {
        return headerSize;
    }

}
