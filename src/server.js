
import Session from './session';
import Message, {HEADER_SIZE as MESSAGE_HEADER_SIZE} from './message';
import Property, {HEADER_SIZE as ELEMENT_HEADER_SIZE} from './property';
// import CFLBinaryPList from './cflbinary';

import net from 'net';

export default class Server {
    constructor(host, port, password) {
        this.host = host;
        this.port = port;
        this.password = password;

        this.socket = undefined;
    }

    listen(_timeout) {
        return new Promise((resolve, reject) => {
            this.socket = new net.Server();

            setTimeout(() => {
                this.reading -= 1;
                reject('Timeout');
            }, _timeout);

            this.socket.listen(this.port, this.host, err => {
                console.log('Connected', err);
                if (err) reject(err);
                else resolve();
            });

            this.socket.on('close', had_error => {
                this.socket = undefined;
            });

            this.socket.on('connection', connection => {
                this.handleConnection(connection);
            });
        });
    }

    close() {
        if (!this.socket) return;

        this.socket.end();

        return new Promise((resolve, reject) => {
            this.socket.on('close', resolve);
        });
    }

    handleConnection(socket) {
        const session = new Session(socket.remoteAddress, socket.remotePort, this.password);
        session.socket = socket;

        console.log('New connection from', session.host, session.port);

        socket.on('data', data => {
            console.debug(0, 'Receiving data', data, 'on connection', session.host + ' port ' + session.port);
            if (session.reading) return;

            session.buffer += data.toString('binary');

            // Try decoding the data as a message
            this.handleData(session);
        });
    }

    async handleData(session) {
        while (session.buffer.length >= MESSAGE_HEADER_SIZE) {
            await this.tryHandleMessage(session);
        }
    }

    async tryHandleMessage(session) {
        try {
            const [message, data] = await Message.parseRaw(session.buffer, true);

            session.buffer = data;

            if (message.body.length !== message.body_size) {
                // Haven't received the message body yet
                return;
            }

            // session.buffer = session.buffer.substr(MESSAGE_HEADER_SIZE);

            this.handleMessage(session, message);
        } catch (err) {
            console.error('Error handling message from', session.host, session.port, err);
        }
    }

    async handleMessage(session, message) {
        console.log('Received message', message);

        switch (message.command) {
        // Get prop
        case 0x14: {
            let data = message.body;
            const props = [];

            // Read the requested props into an array of Propertys
            while (data.length) {
                const prop_header = data.substr(0, ELEMENT_HEADER_SIZE);
                const prop_data = await Property.parseRawElementHeader(prop_header);
                console.debug(prop_data);
                const {name, size} = prop_data;

                const value = data.substr(0, ELEMENT_HEADER_SIZE + size);
                data = data.substr(ELEMENT_HEADER_SIZE + size);

                const prop = new Property(name, value);

                if (typeof prop.name === 'undefined' && typeof prop.value === 'undefined') {
                    break;
                }

                props.push(prop);
            }

            // Send back an array of Propertys
            const ret = this.getProperties(props);

            let payload = '';
            let i = 0;

            for (let prop of ret) {
                payload += Property.composeRawElement(0, prop instanceof Property ? prop : new Property(props[i], prop));
                i++;
            }

            // eslint-disable-next-line no-unused-vars
            const response = Message.composeGetPropCommand(4, this.password, payload);

            return;
        }
        }
    }

    getProperties(props) {
        return props.map(prop => this.getProperty(prop));
    }

    getProperty(prop) {
        if (prop.name === 'dbug') return new Property('dbug', 0x3000);
    }
}
