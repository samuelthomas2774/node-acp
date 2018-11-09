const {default: Message, generateACPHeaderKey} = require('../dist/message');

const QUnit = require('qunit');
const adler32 = require('adler32');

QUnit.test('Pack header', function (assert) {
    const expected_hex = '61637070000300010000000000000000ffffffff000000040000000000000014000000000000000000000000000000007a5c8b71ad6f324f0cac857d868ab5173e09c835f431657f3c9cb56d969aa507000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

    const message = new Message(0x00030001, 4, 0, 0x14, 0, generateACPHeaderKey('testing'));

    const packed = Message.packHeader({
        magic: Message.headerMagic,
        version: message.version,
        header_checksum: 0,
        body_checksum: 0,
        body_size: message.bodySize,
        flags: message.flags,
        unused: message.unused,
        command: message.command,
        error_code: message.errorCode,
        key: message.key,
    });

    const message_hex = Buffer.from(packed, 'binary').toString('hex');

    assert.equal(message_hex, expected_hex);
});

QUnit.test('Pack header with checksum', function (assert) {
    const expected_hex = '6163707000030001214613e500000000ffffffff000000040000000000000014000000000000000000000000000000007a5c8b71ad6f324f0cac857d868ab5173e09c835f431657f3c9cb56d969aa507000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

    const message = new Message(0x00030001, 4, 0, 0x14, 0, generateACPHeaderKey('testing'));

    const packed = Message.packHeader({
        magic: Message.headerMagic,
        version: message.version,
        header_checksum: 0,
        body_checksum: 0,
        body_size: message.bodySize,
        flags: message.flags,
        unused: message.unused,
        command: message.command,
        error_code: message.errorCode,
        key: message.key,
    });

    const header_checksum = adler32.sum(Buffer.from(packed, 'binary'));

    console.log('Header checksum', header_checksum);

    assert.equal(header_checksum, 558240741);

    const packed_checksum = Message.packHeader({
        magic: Message.headerMagic,
        version: message.version,
        header_checksum,
        body_checksum: 0,
        body_size: message.bodySize,
        flags: message.flags,
        unused: message.unused,
        command: message.command,
        error_code: message.errorCode,
        key: message.key,
    });

    const message_hex = Buffer.from(packed_checksum, 'binary').toString('hex');

    assert.equal(message_hex, expected_hex);
});

QUnit.test('Compose get prop command', function (assert) {
    // Property.composeRawElement(0, new Property('dbug'))
    const payload_hex = '64627567000000000000000400000000';
    const payload = Buffer.from(payload_hex, 'hex').toString('binary');

    const expected_hex = '61637070000300011bef117b17c301a700000010000000040000000000000014000000000000000000000000000000007a5c8b71ad6f324f0cac857d868ab5173e09c835f431657f3c9cb56d969aa50700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000064627567000000000000000400000000';

    const message = Message.composeGetPropCommand(4, 'testing', payload);
    const message_hex = Buffer.from(message, 'binary').toString('hex');

    assert.equal(message_hex, expected_hex);
});

QUnit.test('Parse raw command', async function (assert) {
    const raw_message_hex = '61637070000300011bef117b17c301a700000010000000040000000000000014000000000000000000000000000000007a5c8b71ad6f324f0cac857d868ab5173e09c835f431657f3c9cb56d969aa50700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000064627567000000000000000400000000';
    const raw_message = Buffer.from(raw_message_hex, 'hex').toString('binary');

    const message = await Message.parseRaw(raw_message, false);

    assert.equal(message.version, 196609);
    assert.equal(message.flags, 4);
    assert.equal(message.unused, 0);
    assert.equal(message.command, 20);
    assert.equal(message.errorCode, 0);
    assert.equal(message.key, Buffer.from('7a5c8b71ad6f324f0cac857d868ab5173e09c835f431657f3c9cb56d969aa507', 'hex').toString('binary'));
    assert.equal(message.body, Buffer.from('64627567000000000000000400000000', 'hex').toString('binary'));
    assert.equal(message.bodySize, 16);
    assert.equal(message.bodyChecksum, 398655911);
});
