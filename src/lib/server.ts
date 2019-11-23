
import Session from './session';
import Message, {HEADER_SIZE as MESSAGE_HEADER_SIZE} from './message';
import Property, {HEADER_SIZE as ELEMENT_HEADER_SIZE, SupportedValues, PropType} from './property';
import {PropName, PropTypes} from './properties';
import CFLBinaryPList from './cflbinary';
import {LogLevel, loglevel} from '..';

import net from 'net';
import crypto from 'crypto';
import * as srp from 'fast-srp-hap';

export default class Server {
    readonly host: string;
    readonly port: number;

    password: string | null = null;
    readonly users = new Map<string, {
        params: srp.SrpParams;
        salt: Buffer;
        verifier: Buffer;
        password?: string;
    }>();

    socket: net.Server | null = null;

    private reading: number | null = null;

    constructor(host: string, port: number) {
        this.host = host;
        this.port = port;
    }

    /**
     * Adds a user.
     *
     * @param {string} username
     * @param {Buffer|string} password (or verifier)
     * @param {Buffer} [salt] Must be 16 bytes
     * @param {object} [params] srp.params[1536]
     */
    async addUser(username: string, password: string): Promise<void>;
    async addUser(username: string, verifier: Buffer, salt?: Buffer, params?: srp.SrpParams): Promise<void>;
    async addUser(username: string, password: Buffer | string, salt?: Buffer, params?: srp.SrpParams) {
        if (username === 'admin') this.password = password instanceof Buffer ? password.toString() : password;

        // The verifier isn't actually used as fast-srp-hap doesn't accept verifiers
        // const salt = await new Promise((rs, rj) => srp.genKey(16, (err, secret2) => err ? rj(err) : rs(secret2)));
        if (!params) params = srp.params[1536];
        if (!salt) salt = crypto.randomBytes(16); // .length === 128
        const verifier = password instanceof Buffer ? password :
            srp.computeVerifier(params, salt, Buffer.from(username), Buffer.from(password));

        this.users.set(username, {params, salt, verifier, password: typeof password === 'string' ? password : undefined});
    }

    listen(timeout?: number) {
        return new Promise((resolve, reject) => {
            this.socket = new net.Server();

            setTimeout(() => {
                // this.reading -= 1;
                reject('Timeout');
            }, timeout);

            // @ts-ignore
            this.socket.listen(this.port, this.host, err => {
                if (loglevel >= LogLevel.INFO) console.log('Listening', this.host, this.port, err);
                if (err) reject(err);
                else resolve();
            });

            this.socket.on('close', (had_error: boolean) => {
                this.socket = null;
            });

            this.socket.on('connection', connection => {
                this.handleConnection(connection);
            });
        });
    }

    close() {
        if (!this.socket) return;

        this.socket.close();

        return new Promise((resolve, reject) => {
            this.socket!.on('close', resolve);
        });
    }

    handleConnection(socket: net.Socket) {
        const session = new Session(socket.remoteAddress!, socket.remotePort!, this.password!);
        session.socket = socket;

        if (loglevel >= LogLevel.INFO) console.log('New connection from', session.host, session.port);

        socket.on('data', data => {
            if (loglevel >= LogLevel.DEBUG) console.debug(0, 'Receiving data', data, 'on connection', session.host + ' port ' + session.port);
            if (session.reading) return;

            session.emit('raw-data', data);

            if (session.encryption) {
                data = session.encryption.decrypt(data);
                if (loglevel >= LogLevel.DEBUG) console.debug(0, 'Decrypted', data);
            }

            session.emit('data', data);

            session.buffer = Buffer.concat([session.buffer, data]);

            // Try decoding the data as a message
            this.handleData(session);
        });

        return session;
    }

    async handleData(session: Session) {
        while (session.buffer.length >= MESSAGE_HEADER_SIZE) {
            await this.tryHandleMessage(session);
        }
    }

    async tryHandleMessage(session: Session) {
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
            if (loglevel >= LogLevel.WARNING) console.error('Error handling message from', session.host, session.port, err);
            session.buffer = Buffer.alloc(0);
        }
    }

    async handleMessage(session: Session & {
        authenticating_user?: string;
        srp?: srp.Server;
    }, message: Message) {
        // console.log('Received message', message);

        switch (message.command) {
        // Authenticate
        case 0x1a: {
            const data = CFLBinaryPList.parse(message.body!);

            if (loglevel >= LogLevel.DEBUG) console.debug('Authenticate request from', session.host, session.port, data);

            if (data.state === 1) {
                if (loglevel >= LogLevel.DEBUG) console.debug('Authenticate stage one');

                const user = this.users.get(data.username);
                session.authenticating_user = data.username;

                // console.log('Authenticating user', user);

                const key = crypto.randomBytes(24); // .length === 192
                const params = user && user.params || srp.params[1536];
                const salt = user && user.salt || Buffer.from(crypto.randomBytes(16));

                // Why doesn't fast-srp-hap allow using a verifier instead of storing the plain text password?
                // const verifier = srp.computeVerifier(params, salt, Buffer.from(username), Buffer.from(password));

                const srps = new srp.Server(params, salt, Buffer.from(data.username), Buffer.from(user!.password!), key);
                session.srp = srps;

                const payload = {
                    salt,
                    generator: params.g.toBuffer(true),
                    publicKey: srps.computeB(),
                    modulus: params.N.toBuffer(true),
                };

                if (loglevel >= LogLevel.DEBUG) console.debug('Stage one response payload', payload);

                await session.send(Message.composeAuthCommand(5, CFLBinaryPList.compose(payload)));
            } else if (data.state === 3) {
                if (loglevel >= LogLevel.DEBUG) console.debug('Authenticate stage three');

                const user = this.users.get(session.authenticating_user!); // eslint-disable-line no-unused-vars
                const srps = session.srp!;

                srps.setA(data.publicKey);

                try {
                    srps.checkM1(data.response); // throws error if wrong
                } catch (err) {
                    if (loglevel >= LogLevel.INFO) console.error('Error checking password', err.message);
                    session.socket!.destroy();
                    return;
                }

                const M2 = srps.computeM2();
                const iv = crypto.randomBytes(16);

                const payload = {
                    response: M2,
                    iv,
                };

                if (loglevel >= LogLevel.DEBUG) console.debug('Stage three response payload', payload);

                await session.send(Message.composeAuthCommand(5, CFLBinaryPList.compose(payload)));

                const key = srps.computeK();
                const client_iv = data.iv;

                // Enable session encryption
                if (loglevel >= LogLevel.DEBUG) console.debug('Enabling session encryption');
                session.enableServerEncryption(key, client_iv, iv);
            } else {
                if (loglevel >= LogLevel.DEBUG) console.error('Unknown auth stage', data.state, message, data);
            }

            // console.log(payload, CFLBinaryPList.parse(payload));

            return;
        }

        // Get prop
        case 0x14: {
            if (loglevel >= LogLevel.DEBUG) console.log('Received get prop command');

            let data = message.body!;
            const props: Property[] = [];

            // Read the requested props into an array of Propertys
            while (data.length) {
                const prop_header = data.slice(0, ELEMENT_HEADER_SIZE);
                const prop_data = await Property.unpackHeader(prop_header);
                const {name, size} = prop_data;

                const value = data.slice(ELEMENT_HEADER_SIZE, size);
                data = data.slice(ELEMENT_HEADER_SIZE + size);

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
                await session.send(Property.composeRawElement(0,
                    prop instanceof Property ? prop : new Property(props[i].name, prop)));
                i++;
            }

            await session.send(Property.composeRawElement(0, new Property()));

            return;
        }
        }

        if (loglevel >= LogLevel.DEBUG) console.error('Unknown command', message.command, message);
    }

    getProperties(props: Property[]) {
        return Promise.all(props.map(prop => this.getProperty(prop)));
    }

    getProperty<N extends PropName, T extends PropType = PropTypes[N]>(prop: Property<N>): Property | Buffer | string | SupportedValues[T] {
        if (prop.name === 'dbug') return new Property('dbug', 0x3000);
    }
}
