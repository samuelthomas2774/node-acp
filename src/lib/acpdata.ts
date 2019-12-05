
import {props, ValueFormatters, FormattedValues} from './property';
import {PropName, PropTypes} from './properties';
import {promises as fs} from 'fs';

/**
 * Decodes ACPData.bin files used to store ACP properties.
 */
export default class ACPData extends Map<PropName, Buffer> {
    constructor() {
        super();
    }

    toJSON() {
        const data: {[N in PropName]?: FormattedValues[PropTypes[N]];} = {};

        for (const [name, value] of this.entries()) {
            const info = props.find(p => p.name === name);
            if (!info) {
                console.warn('Unknown property', name);
                data[name] = value;
                continue;
            }
            const formatted = ValueFormatters[info.type](value);
            data[name] = formatted;
        }

        return data;
    }

    static load(file: string): Promise<ACPData>
    static load(data: Buffer): ACPData
    static load(data: string | Buffer) {
        return data instanceof Buffer ? this.loadData(data) : this.loadFile(data);
    }

    private static async loadFile(file: string) {
        return this.loadData(await fs.readFile(file));
    }

    private static loadData(data: Buffer) {
        const acpdata = new ACPData();

        const header = data.slice(0, 32);
        // No idea what these first 32 bytes are
        // 6E76726D 00000001 69B604F2 BE26D05D 00003F84 00000059 00000000 00000000
        const body = data.slice(32);

        let remaining_data = body;

        while (remaining_data.length) {
            const name = remaining_data.slice(0, 4).toString('utf-8');
            const length1 = remaining_data.readUInt32BE(4);
            const length = remaining_data.readUInt32BE(8);
            const value = remaining_data.slice(12, 12 + length);

            // console.log('Reading property', name, length1, length);

            if (length1 !== 0) console.warn('Bytes 4-8 is not 0');
            if (acpdata.has(name)) console.warn('Duplicate property %s', name);

            acpdata.set(name, value);

            remaining_data = remaining_data.slice(12 + length);
        }

        return acpdata;
    }
}
