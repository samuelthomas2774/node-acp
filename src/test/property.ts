import {Property} from '../index';
import 'qunit';

QUnit.test('Compose raw element header', assert => {
    const expected_hex = '646275670000000000000004';

    const header = Property.composeRawElementHeader('dbug', 0, 4);
    const header_hex = header.toString('hex');

    assert.equal(expected_hex, header_hex);
});

QUnit.test('Compose raw element', assert => {
    const expected_hex = '64627567000000000000000400000000';

    const raw_element = Property.composeRawElement(0, new Property('dbug'));
    const raw_element_hex = raw_element.toString('hex');

    assert.equal(expected_hex, raw_element_hex);
});

QUnit.test('Parse raw element', async assert => {
    const raw_element_hex = '64627567000000000000000400003000';
    const raw_element = Buffer.from(raw_element_hex, 'hex').toString('binary');

    const property = await Property.parseRawElement(raw_element) as Property<'dbug'>;

    assert.equal(property.name, 'dbug');
    assert.equal(parseInt(property.format()), 0x3000);
});
