
import Session from './session';
import Message, {HEADER_SIZE as MESSAGE_HEADER_SIZE} from './message';
import Property, {HEADER_SIZE as ELEMENT_HEADER_SIZE} from './property';
import CFLBinaryPList from './cflbinary';

import net from 'net';
import crypto from 'crypto';
import srp from 'fast-srp-hap';

export default class Server {
    constructor(host, port) {
        this.host = host;
        this.port = port;

        this.password = null;
        this.users = new Map();

        this.socket = undefined;
    }

    /**
     * Adds a user.
     *
     * @param {string} username
     * @param {Buffer|string} password (or verifier)
     * @param {Buffer} [salt] Must be 16 bytes
     * @param {object} [params] srp.params[1536]
     */
    async addUser(username, password, salt, params) {
        if (username === 'admin') this.password = password;

        // The verifier isn't actually used as fast-srp-hap doesn't accept verifiers
        // const salt = await new Promise((rs, rj) => srp.genKey(16, (err, secret2) => err ? rj(err) : rs(secret2)));
        if (!params) params = srp.params[1536];
        if (!salt) salt = crypto.randomBytes(16); // .length === 128
        const verifier = password instanceof Buffer ? password :
            srp.computeVerifier(params, salt, Buffer.from(username), Buffer.from(password));

        this.users.set(username, {params, salt, verifier, password});
    }

    listen(_timeout) {
        return new Promise((resolve, reject) => {
            this.socket = new net.Server();

            setTimeout(() => {
                this.reading -= 1;
                reject('Timeout');
            }, _timeout);

            this.socket.listen(this.port, this.host, err => {
                console.log('Listening', this.host, this.port, err);
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

            session.emit('raw-data', data);

            if (session.encryption) {
                data = session.encryption.decrypt(data);
                console.debug(0, 'Decrypted', data);
            }

            session.emit('data', data);

            session.buffer += data.toString('binary');

            // Try decoding the data as a message
            this.handleData(session);
        });

        return session;
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

            if (!message.body || message.body.length !== message.body_size) {
                // Haven't received the message body yet
                return;
            }

            // session.buffer = session.buffer.substr(MESSAGE_HEADER_SIZE);

            this.handleMessage(session, message);
        } catch (err) {
            console.error('Error handling message from', session.host, session.port, err);
            session.buffer = '';
        }
    }

    async handleMessage(session, message) {
        // console.log('Received message', message);

        switch (message.command) {
        // Authenticate
        case 0x1a: {
            const data = CFLBinaryPList.parse(message.body);

            console.log('Authenticate request from', session.host, session.port, data);

            if (data.state === 1) {
                console.log('Authenticate stage one');

                const user = this.users.get(data.username);
                session.authenticating_user = data.username;

                // console.log('Authenticating user', user);

                const key = crypto.randomBytes(24); // .length === 192
                const params = user.params || srp.params[1536];
                const salt = user.salt || Buffer.from(crypto.randomBytes(16));

                // Why doesn't fast-srp-hap allow using a verifier instead of storing the plain text password?
                // const verifier = srp.computeVerifier(params, salt, Buffer.from(username), Buffer.from(password));

                const srps = new srp.Server(params, salt, Buffer.from(data.username), Buffer.from(user.password), key);
                session.srp = srps;

                const payload = {
                    salt,
                    generator: params.g.toBuffer(true),
                    publicKey: srps.computeB(),
                    modulus: params.N.toBuffer(true),
                };

                console.log('Stage one response payload', payload);

                await session.send(Message.composeAuthCommand(5, CFLBinaryPList.compose(payload)));
            } else if (data.state === 3) {
                console.log('Authenticate stage three');

                const user = this.users.get(session.authenticating_user);
                const srps = session.srp;

                srps.setA(data.publicKey);

                try {
                    srps.checkM1(data.response); // throws error if wrong
                } catch (err) {
                    console.error('Error checking password', err.message);
                    session.socket.destroy();
                    return;
                }

                const M2 = srps.computeM2();
                const iv = crypto.randomBytes(16);

                const payload = {
                    response: M2,
                    iv,
                };

                console.log('Stage three response payload', payload);

                await session.send(Message.composeAuthCommand(5, CFLBinaryPList.compose(payload)));

                const key = srps.computeK();
                const client_iv = data.iv;

                // Enable session encryption
                console.log('Enabling session encryption');
                session.enableServerEncryption(key, client_iv, iv);
            } else {
                console.error('Unknown auth stage', data.state, message, data);
            }

            // console.log(payload, CFLBinaryPList.parse(payload));

            return;
        }

        // Get prop
        case 0x14: {
            console.log('Received get prop command');

            let data = message.body;
            const props = [];

            // Read the requested props into an array of Propertys
            while (data.length) {
                const prop_header = data.substr(0, ELEMENT_HEADER_SIZE);
                const prop_data = await Property.unpackHeader(prop_header);
                const {name, size} = prop_data;

                const value = data.substr(ELEMENT_HEADER_SIZE, size);
                data = data.substr(ELEMENT_HEADER_SIZE + size);

                const prop = new Property(name, value);

                if (typeof prop.name === 'undefined' && typeof prop.value === 'undefined') {
                    break;
                }

                props.push(prop);
            }

            // Send back an array of Propertys
            const ret = await this.getProperties(props);

            await session.send(Message.composeGetPropCommand(5, ''));

            let i = 0;
            for (let prop of ret) {
                await session.send(Property.composeRawElement(0, prop instanceof Property ? prop : new Property(props[i].name, prop)));
                i++;
            }

            await session.send(Property.composeRawElement(0, new Property()));

            return;
        }
        }

        console.error('Unknown command', message.command, message);
    }

    getProperties(props) {
        return Promise.all(props.map(prop => this.getProperty(prop)));
    }

    getProperty(prop) {
        if (prop.name === 'dbug') return new Property('dbug', 0x3000);
    }
}
