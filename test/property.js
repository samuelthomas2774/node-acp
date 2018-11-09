const {default: Property} = require('../dist/property');

const QUnit = require('qunit');

QUnit.test('Compose raw element header', function (assert) {
    const expected_hex = '646275670000000000000004';

    const header = Property.composeRawElementHeader('dbug', 0, 4);
    const header_hex = Buffer.from(header, 'binary').toString('hex');

    assert.equal(expected_hex, header_hex);
});

QUnit.test('Compose raw element', function (assert) {
    const expected_hex = '64627567000000000000000400000000';

    const raw_element = Property.composeRawElement(0, new Property('dbug'));
    const raw_element_hex = Buffer.from(raw_element, 'binary').toString('hex');

    assert.equal(expected_hex, raw_element_hex);
});

QUnit.test('Parse raw element', async function (assert) {
    const raw_element_hex = '64627567000000000000000400003000';
    const raw_element = Buffer.from(raw_element_hex, 'hex').toString('binary');

    const property = await Property.parseRawElement(raw_element);

    assert.equal(property.name, 'dbug');
    assert.equal(property.value, 0x3000);
});
