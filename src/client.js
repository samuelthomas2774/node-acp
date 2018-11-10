
import Session from './session';
import Message from './message';
import Property, {elementHeaderSize} from './property';
// import { CFLBinaryPListParser } from './cflbinary';

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
        return this.receive(Message.headerSize);
    }

    receivePropertyElementHeader() {
        return this.receive(elementHeaderSize);
    }

    async getProperties(prop_names) {
        let payload = '';
        for (let name of prop_names) {
            payload += Property.composeRawElement(0, new Property(name));
        }

        const request = Message.composeGetPropCommand(4, this.password, payload);
        await this.send(request);

        const reply = await this.receiveMessageHeader();
        const replyHeader = await Message.parseRaw(reply);

        console.debug('Reply:', {
            reply, replyHeader,
        });

        if (replyHeader.errorCode !== 0) {
            console.log('Client.getProperties error code:', replyHeader.errorCode);
            return [];
        }

        const props = [];

        while (true) {
            const propHeader = await this.receivePropertyElementHeader();
            console.debug('Received property element header:', propHeader);
            const {name, flags, size} = await Property.parseRawElementHeader(propHeader);

            const propData = await this.receive(size);

            if (flags & 1) {
                const errorCode = Buffer.from(propData, 'binary').readInt32BE(0);
                console.log('error requesting value for property', name, '-', errorCode);
                continue;
            }

            const prop = new Property(name, propData);
            console.debug('prop', prop);

            if (typeof prop.name === 'undefined' && typeof prop.value === 'undefined') {
                console.debug('found empty prop end marker');
                break;
            }

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

        const rawReply = await this.receiveMessageHeader();
        const replyHeader = await Message.parseRaw(rawReply);

        if (replyHeader.errorCode !== 0) {
            console.log('set properties error code', replyHeader.errorCode);
            return;
        }

        const propHeader = await this.receivePropertyElementHeader();
        const {name, flags, size} = await Property.parseRawElementHeader(propHeader);

        const propData = await this.receive(size);

        if (flags) {
            const errorCode = Buffer.from(propData, 'binary').readUInt32BE(0);
            console.log('error setting value for property', name, '-', errorCode);
            return;
        }

        const prop = new Property(name, propData);
        console.debug('prop', prop);

        if (typeof prop.name === 'undefined' && typeof prop.value === 'undefined') {
            console.debug('found empty prop end marker');
        }
    }

    async getFeatures() {
        this.send(Message.composeFeatCommand(0));
        const replyHeader = await Message.parseRaw(this.receiveMessageHeader());
        const reply = await this.receive(replyHeader.bodySize);
        return CFLBinaryPListParser.parse(reply);
    }

    async flashPrimary(payload) {
        this.send(Message.composeFlashPrimaryCommand(0, this.password, payload));
        const replyHeader = await Message.parseRaw(this.receiveMessageHeader());
        return await this.receive(replyHeader.bodySize);
    }
}
