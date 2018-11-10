
import Session from './session';
import Message, {HEADER_SIZE as MESSAGE_HEADER_SIZE} from './message';
import Property, {HEADER_SIZE as ELEMENT_HEADER_SIZE} from './property';
import CFLBinaryPList from './cflbinary';

export default class Client {
    constructor(host, port, password) {
        this.host = host;
        this.port = port;
        this.password = password;

        this.session = new Session(host, port, password);
    }

    connect(timeout) {
        return this.session.connect(timeout);
    }

    disconnect() {
        return this.session.close();
    }

    send(data) {
        return this.session.send(data);
    }

    receive(size) {
        return this.session.receive(size);
    }

    receiveMessageHeader() {
        return this.receive(MESSAGE_HEADER_SIZE);
    }

    receivePropertyElementHeader() {
        return this.receive(ELEMENT_HEADER_SIZE);
    }

    /**
     * Gets properties from the AirPort device.
     *
     * Client: GetProp {...Property}
     * Server: GetProp
     * Server: ...Property
     */
    async getProperties(prop_names) {
        let payload = '';

        for (let name of prop_names) {
            payload += Property.composeRawElement(0, name instanceof Property ? name : new Property(name));
        }

        const request = Message.composeGetPropCommand(4, this.password, payload);
        await this.send(request);

        const reply = await this.receiveMessageHeader();
        const reply_header = await Message.parseRaw(reply);

        if (reply_header.error_code !== 0) {
            throw new Error('Error ' . reply_header.error_code);
        }

        const props = [];

        while (true) {
            const prop_header = await this.receivePropertyElementHeader();
            console.debug('Received property element header:', prop_header);
            const data = await Property.parseRawElementHeader(prop_header);
            console.debug(data);
            const {name, flags, size} = data;

            const value = await this.receive(size);

            if (flags & 1) {
                const error_code = Buffer.from(value, 'binary').readInt32BE(0);
                throw new Error('Error requesting value for property "' + name + '": ' + error_code);
            }

            const prop = new Property(name, value);

            if (typeof prop.name === 'undefined' && typeof prop.value === 'undefined') {
                break;
            }

            console.debug('Prop', prop);

            props.push(prop);
        }

        return props;
    }

    async setProperties(props) {
        let payload = '';

        for (let prop of props) {
            payload += Property.composeRawElement(0, prop);
        }

        const request = Message.composeSetPropCommand(0, this.password, payload);
        await this.send(request);

        const raw_reply = await this.receiveMessageHeader();
        const reply_header = await Message.parseRaw(raw_reply);

        if (reply_header.error_code !== 0) {
            console.log('set properties error code', reply_header.error_code);
            return;
        }

        const prop_header = await this.receivePropertyElementHeader();
        const {name, flags, size} = await Property.parseRawElementHeader(prop_header);

        const value = await this.receive(size);

        if (flags & 1) {
            const error_code = Buffer.from(value, 'binary').readUInt32BE(0);
            throw new Error('Error setting value for property "' + name + '": ' + error_code);
        }

        const prop = new Property(name, value);
        console.debug('Prop', prop);

        if (typeof prop.name === 'undefined' && typeof prop.value === 'undefined') {
            console.debug('found empty prop end marker');
        }
    }

    async getFeatures() {
        await this.send(Message.composeFeatCommand(0));
        const reply_header = await Message.parseRaw(await this.receiveMessageHeader());
        const reply = await this.receive(reply_header.body_size);
        return CFLBinaryPList.parse(reply);
    }

    async flashPrimary(payload) {
        this.send(Message.composeFlashPrimaryCommand(0, this.password, payload));
        const reply_header = await Message.parseRaw(this.receiveMessageHeader());
        return await this.receive(reply_header.body_size);
    }
}
