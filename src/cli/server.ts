import {Server, Session, Message, CFLBinaryPList, Property} from '..';
import {replacer} from '../lib/util';
import {syLR} from '../lib/property-types';
import {RPCInputData, RPCOutputData} from '../lib/rpc-types';
import {LocalStorage} from 'node-persist';

const SYLR_REGIONS: syLR = require('../../resources/region-data');

/**
 * Test ACP server implementation that saves properties to a node-persist instance.
 */
export default class TestServer extends Server {
    /**
     * @param {string} host IP address to listen on
     * @param {number} port Port to listen on
     * @param {string} password Admin password
     * @param {persist.LocalStorage} storage node-persist instance to save data to
     */
    constructor(
        readonly host: string, readonly port: number, readonly password: string, readonly storage: LocalStorage
    ) {
        super(host, port);

        this.addUser('admin', password);
    }

    /**
     * Handles a message.
     *
     * @param {Session} session
     * @param {Message} message
     * @return {Promise}
     */
    async handleMessage(session: Session, message: Message) {
        // @ts-ignore
        global.session = session;

        return super.handleMessage(session, message);
    }

    /**
     * Handles a monitor message.
     *
     * @param {Session} session
     * @param {Message} message
     */
    async handleMonitorMessage(session: Session, message: Message) {
        const [null_data, body] = [message.body!.slice(0, 4), message.body!.slice(4)];

        try {
            const data = CFLBinaryPList.parse(body);
            console.log('Monitor data', data, JSON.stringify(data));
        } catch (err) {
            console.log('Monitor data parse error', err);
        }

        const res = Message.composeMonitorCommand(0, '', Buffer.from([0, 0, 0, 0]));
        console.log('Monitor response', res);

        await session.send(res);
    }

    /**
     * Handles an RPC message.
     *
     * @param {Session} session
     * @param {Message} message
     */
    async handleRPCMessage(session: Session, message: Message) {
        try {
            const data: RPCInputData = CFLBinaryPList.parse(message.body!);

            console.log('RPC data', data, JSON.stringify(data, replacer));
        } catch (err) {
            console.log('RPC data parse error', err);
        }

        const resdata: RPCOutputData = {outputs: {}, status: 0};

        const res = Message.composeRPCCommand(0, '', CFLBinaryPList.compose(resdata));
        await session.send(res);
    }

    properties: {[name: string]: Buffer | Error} = {};
    modified = false;

    /**
     * Gets properties.
     *
     * @param {Property[]} props
     * @return {Property[]}
     */
    async getProperties(props: Property[]) {
        const ret = await super.getProperties(props);
        if (this.modified) {
            await this.storage.setItem('Properties', this.properties);
            this.modified = false;
        }
        return ret;
    }

    /**
     * Gets a property.
     *
     * @param {Property} prop
     * @return {Property|Buffer}
     */
    async getProperty(prop: Property) {
        if (prop.name === 'syLR') return new Property('syLR', SYLR_REGIONS);

        if (this.properties[prop.name] instanceof Buffer) return this.properties[prop.name] as Buffer;
        if (this.properties[prop.name] instanceof Error) throw this.properties[prop.name];
        if (this.properties.hasOwnProperty(prop.name)) return new Property(prop.name, this.properties[prop.name]);
        this.modified = true;
        throw this.properties[prop.name] = new Error('Unknown property');
    }

    /**
     * Sets properties.
     *
     * @param {Property[]} props
     * @return {Property[]}
     */
    async setProperties(props: Property[]) {
        const ret = await super.setProperties(props);
        if (this.modified) {
            // fs.writeFileSync('properties.json', JSON.stringify(this.properties, replacer, 4) + '\n', 'utf-8');
            await this.storage.setItem('Properties', this.properties);
            this.modified = false;
        }
        return ret;
    }

    /**
     * Sets a property.
     *
     * @param {Property} prop
     */
    async setProperty(prop: Property) {
        this.properties[prop.name] = prop.format();
        this.modified = true;
    }
}
