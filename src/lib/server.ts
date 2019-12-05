
import Session from './session';
import Message, {HEADER_SIZE as MESSAGE_HEADER_SIZE, MessageType, ErrorCode, generateACPHeaderKey} from './message';
import Property, {HEADER_SIZE as ELEMENT_HEADER_SIZE, SupportedValues, PropType} from './property';
import {PropName, PropTypes} from './properties';
import PropertyValueTypes, {StatusCode} from './property-types';
import CFLBinaryPList from './cflbinary';
import {LogLevel, loglevel} from '..';

import net from 'net';
import crypto from 'crypto';
import * as srp from 'fast-srp-hap';

export default abstract class Server {
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

            session.emit('raw-data', data);

            if (session.encryption) {
                data = session.encryption.decrypt(data);
                if (loglevel >= LogLevel.DEBUG) console.debug(0, 'Decrypted', data);
            }

            session.emit('data', data);

            session.buffer = Buffer.concat([session.buffer, data]);
            if (session.reading) return;

            // Try decoding the data as a message
            this.handleData(session);
        });

        socket.on('close', had_error => {
            if (loglevel >= LogLevel.INFO) console.log('Session closed', session.host, session.port, had_error);
            session.socket = null;
        });

        return session;
    }

    private _handlingData = false;

    async handleData(session: Session) {
        if (this._handlingData) return;
        this._handlingData = true;
        let bytes;
        do {
            bytes = session.buffer.length;
            await this.tryHandleMessage(session);
        } while (session.buffer.length >= MESSAGE_HEADER_SIZE && (bytes < session.buffer.length));
        this._handlingData = false;
    }

    async tryHandleMessage(session: Session) {
        try {
            const buffer = session.buffer;
            const [message, data] = Message.parseRaw(buffer, true);

            session.buffer = data;

            if (message.body_size === -1) {
                // TODO: streams
                console.error('Streams not supported');
                session.socket!.destroy();
                return;
            }

            if (!message.body || message.body.length !== message.body_size) {
                // Haven't received the message body yet
                console.log('Waiting for the rest of the message, expected %d bytes, received %d',
                    message.body_size, data.length);
                session.buffer = buffer;
                return;
            }

            // session.buffer = session.buffer.substr(MESSAGE_HEADER_SIZE);

            await this.handleMessage(session, message);
        } catch (err) {
            if (loglevel >= LogLevel.WARNING) console.error('Error handling message from', session.host, session.port, err);
            session.buffer = Buffer.alloc(0);
        }
    }

    async handleMessage(session: Session, message: Message) {
        console.log('Received message', message);

        // @ts-ignore
        session.messages = session.messages || [];
        // @ts-ignore
        session.messages.push(message);

        switch (message.command) {
            case MessageType.AUTHENTICATE: return this.handleAuthenticateMessage(session, message);
            case MessageType.GET_PROPERTY: return this.handleGetPropertyMessage(session, message);
            case MessageType.MONITOR: return this.handleMonitorMessage(session, message);
            case MessageType.RPC: return this.handleRPCMessage(session, message);
        }

        if (loglevel >= LogLevel.INFO) console.error('Unknown command', message.command, message);
    }

    private async handleAuthenticateMessage(session: Session & {
        authenticating_user?: string;
        srp?: srp.Server;
    }, message: Message) {
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
        } else if (data.state === 3 && session.srp) {
            if (loglevel >= LogLevel.DEBUG) console.debug('Authenticate stage three');

            const user = this.users.get(session.authenticating_user!); // eslint-disable-line no-unused-vars
            const srps = session.srp;

            srps.setA(data.publicKey);

            try {
                srps.checkM1(data.response); // throws error if wrong
            } catch (err) {
                if (loglevel >= LogLevel.INFO) console.error('Error checking password', err.message);
                session.authenticating_user = undefined;
                session.srp = undefined;
                const response = new Message(0x00030001, /* flags */ 5, 0, MessageType.AUTHENTICATE, ErrorCode.INCORRECT_PASSWORD, generateACPHeaderKey(''), Buffer.alloc(0));
                await session.send(response);
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
    }

    private async handleGetPropertyMessage(session: Session, message: Message) {
        if (loglevel >= LogLevel.INFO) console.log('Received get prop command');

        let data = message.body!;
        const props: Property[] = [];

        // Read the requested props into an array of Propertys
        while (data.length) {
            const prop_header = Buffer.concat([
                data.slice(0, ELEMENT_HEADER_SIZE),
                data.length < ELEMENT_HEADER_SIZE ? await session.receive(ELEMENT_HEADER_SIZE - data.length) : Buffer.alloc(0),
            ]);
            const prop_data = Property.unpackHeader(prop_header);
            const {name, size} = prop_data;

            const value = data.slice(ELEMENT_HEADER_SIZE, size); Buffer.concat([
                data.slice(ELEMENT_HEADER_SIZE, size),
                data.length < ELEMENT_HEADER_SIZE + size ? await session.receive((ELEMENT_HEADER_SIZE + size) - data.length) : Buffer.alloc(0),
            ]);
            data = data.slice(Math.min(ELEMENT_HEADER_SIZE + size, data.length));

            const prop = new Property(name, undefined, true);

            if (typeof prop.name === 'undefined' && typeof prop.value === 'undefined') {
                console.log('Finished processing getprop with %d bytes remaining', data.length);
                break;
            }

            props.push(prop);
        }

        console.log('Reading properties', props);

        // Send back an array of Propertys
        const ret = await this.getProperties(props.filter(p => p instanceof Property) as Property[]);

        let response = Buffer.alloc(0);

        let i = 0;
        for (let prop of ret) {
            response = Buffer.concat([
                response,
                prop instanceof Property ? Property.composeRawElement(0x00000000, prop) :
                    Property.composeRawElement(0x00000001, new Property(props[i].name, this.getErrorCodeBuffer(prop), true)),
            ]);
            i++;
        }

        const rm = Message.composeGetPropCommand(5, '', Buffer.concat([
            response,
            Property.composeRawElement(0, new Property()),
        ]));
        console.log('Sending response', rm);

        await session.send(rm);
    }

    private getErrorCodeBuffer(error: Error) {
        const buffer = Buffer.alloc(4);
        buffer.writeInt32BE(this.getErrorCode(error), 0);
        return buffer;
    }

    private getErrorCode(error: Error) {
        return -10;
    }

    getProperties(props: Property[]): Promise<(Property | Error)[]> {
        return Promise.all(props.map(async (prop: Property) => {
            try {
                const ret = await this.getProperty(prop);
                return ret instanceof Property ? ret : new Property(prop!.name, ret);
            } catch (err) {
                console.error('Error getting property %s', prop.name, err);
                return err;
            }
        }));
    }

    abstract getProperty<N extends PropName, T extends PropType = PropTypes[N]>(prop: Property<N>): Property | Buffer | string | Promise<Property | Buffer | string>

    setProperties(props: Property[]): Promise<(Property | Error)[]> {
        return Promise.all(props.map(async (prop: Property) => {
            try {
                await this.setProperty(prop);
                // return ret instanceof Property ? ret : new Property(prop!.name, ret);
                return new Property(prop!.name, Buffer.from([0, 0, 0, 0]), true);
            } catch (err) {
                console.error('Error setting property %s', prop.name, err);
                return err;
            }
        }));
    }

    abstract setProperty<N extends PropName, T extends PropType = PropTypes[N]>(prop: Property<N>): void | Promise<void>

    abstract handleMonitorMessage(session: Session, message: Message): void | Promise<void>

    abstract handleRPCMessage(session: Session, message: Message): void | Promise<void>
}
