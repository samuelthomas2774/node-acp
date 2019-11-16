
import Client, {Server, Property, PropName, PropType, LogLevel, loglevel} from '..'; // eslint-disable-line no-unused-vars
import {ValueFormatters} from '../lib/property';
import * as cfb from '../lib/cflbinary';
import yargs from 'yargs';
import bonjour from 'bonjour';

yargs.demandCommand();
yargs.help();

interface GlobalArguments {
    host?: string;
    port: number;
    password?: string;
    log: LogLevel;
}

yargs.option('host', {
    alias: 'h',
    describe: 'The hostname/IP address of the AirPort device to connect to',
});
yargs.option('port', {
    describe: 'The port of the AirPort device\'s acp daemon (you should only need to change this when you need to use port forwarding to access the device)',
    default: 5009,
});
yargs.option('password', {
    alias: 'p',
    describe: 'The device password of the AirPort device',
});
yargs.option('log', {
    decribe: 'Log level',
    type: 'number',
    default: loglevel,
});

yargs.command('version', 'Shows the node-acp version', () => {}, argv => {
    console.log('node-acp v' + require('../package').version);
    console.log('https://gitlab.fancy.org.uk/samuel/node-acp');
});

interface ServerArguments {
    advertise: boolean;
    'advertise-name': string;
    'advertise-network': string;
    'advertise-address': string;
}

yargs.command('server', 'Start the ACP server', yargs => {
    yargs.option('advertise', {
        describe: 'Whether to advertise the ACP server with DNS SD',
        boolean: true,
    });
    yargs.option('advertise-name', {
        describe: 'The name to advertise the service as',
        default: 'node-acp',
    });
    yargs.option('advertise-network', {
        describe: 'The network name to advertise',
        default: 'node-acp',
    });
    yargs.option('advertise-address', {
        describe: 'The MAC address to advertise',
        default: '00-00-00-00-00-00',
    });
}, async (argv: GlobalArguments & ServerArguments) => {
    const server = new Server(argv.host || '::', argv.port);

    await server.addUser('admin', argv.password!);

    try {
        await server.listen();
    } catch (err) {
        console.error(err);
    }

    // Leave the server to run

    if (argv.advertise) {
        const service = bonjour().publish({
            name: argv['advertise-name'],
            port: argv.port,
            type: 'airport',
            txt: {waMA: '00-00-00-00-00-00,' + Object.entries({
                // waMA: '00-00-00-00-00-00', // Ethernet MAC address
                raMA: argv['advertise-address'], // 5 GHz Wi-Fi MAC address - this is used to identify devices in AirPort Utility
                raM2: '00-00-00-00-00-00', // 2.4 GHz Wi-Fi MAC address
                raNm: argv['advertise-network'], // Network
                raCh: 1, // 2.4 GHz channel
                rCh2: 36, // 5 GHz channel
                raSt: 0, // ?
                raNA: 0, // ?
                syFl: '0x820C', // ?
                syAP: 115, // Model?
                syVs: '7.8', // Version
                srcv: '78000.12', // Build
                bjSd: 43, // ?
                // prob: '',
            }).map(([k, v]) => `${k}=${v}`).join(',')},
        });

        console.log('Advertising service', service);
    }
});

interface ClientCommandArguments extends GlobalArguments {
    encryption?: boolean;
}

const commandHandler = <A extends ClientCommandArguments = ClientCommandArguments>(handler: (client: Client, argv: A) => void) => async (argv: A) => {
    const client = new Client(argv.host || 'airport-base-station.local', argv.port, argv.password!);

    try {
        await client.connect();

        if (argv.encryption) {
            console.log('Authenticating');
            await client.authenticate();
            console.log('Authenticated!');
        }

        await handler.call(undefined, client, argv);
    } catch (err) {
        console.error(err);
    }

    await client.disconnect();
    process.exit();
};

yargs.command('authenticate', 'Authenticate', yargs => {}, commandHandler(async (client, argv: GlobalArguments) => {
    const data = await client.authenticate();

    console.log('Authenticated!', data);

    console.log('Getting syNm prop');
    const props = await client.getProperties(['syNm']);

    console.log(props[0].format());
}));

interface GetPropArguments {
    prop: PropName;
    json: boolean;
    encryption: boolean;
}

yargs.command('getprop <prop>', 'Get an ACP property', yargs => {
    yargs.positional('prop', {
        describe: 'The name of the ACP property',
    });
    yargs.option('json', {
        describe: 'Output value as JSON',
        default: false,
        type: 'boolean',
    });
    yargs.option('encryption', {
        describe: 'Whether to encrypt connections to the AirPort device',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv: GlobalArguments & GetPropArguments) => {
    const [prop] = await client.getProperties([argv.prop]);

    console.log(argv.json ? prop.toString() : prop.format());
}));

interface DebugDumpArguments {
    path: string;
    encryption: boolean;
}

interface DebugData {
    anonUUID: string;
    entries: DebugDataEntry[];
    version: number;
}

interface DebugDataEntry {
    data: Buffer;
    title: string;
    dictID: number;
}

yargs.command('dump-debug <path>', 'Get an ACP property', yargs => {
    yargs.positional('path', {
        describe: 'Path to save to',
    });
    yargs.option('encryption', {
        describe: 'Whether to encrypt connections to the AirPort device',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv: GlobalArguments & DebugDumpArguments) => {
    const {promises: {mkdir, writeFile}} = await import('fs');
    const path = await import('path');

    const [prop] = await client.getProperties(['stat']);
    const data: DebugData = prop.format();

    try {
        await mkdir(argv.path);
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }

    await writeFile(path.join(argv.path, 'anonuuid'), data.anonUUID + '\n', 'utf-8');

    await Promise.all(data.entries.map(async entry => {
        await writeFile(path.join(argv.path, `${entry.dictID}_${entry.title}.log`), entry.data);
    }));
}));

interface PokePropArguments extends GetPropArguments {
    type?: PropType;
    json: boolean;
}

yargs.command('pokeprop <prop> [type]', 'Attempt to get an ACP property and guess it\'s type', yargs => {
    yargs.positional('prop', {
        describe: 'The name of the ACP property',
    });
    yargs.positional('type', {
        describe: 'The type of the ACP property',
    });
    yargs.option('json', {
        describe: 'Output value as JSON',
        default: false,
        type: 'boolean',
    });
    yargs.option('encryption', {
        describe: 'Whether to encrypt connections to the AirPort device',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv: GlobalArguments & PokePropArguments) => {
    const {props: _props} = await import('../lib/property');
    _props.unshift({
        name: argv.prop,
        type: argv.type || 'bin',
        description: '',
        validator: undefined,
    });

    const [prop] = await client.getProperties([argv.prop]);

    console.log(argv.json ? prop.toString() : prop.format());

    if (!argv.type) {
        if (prop.value!.length >= cfb.HEADER_SIZE + cfb.FOOTER_SIZE + 1 &&
            prop.value!.slice(0, cfb.HEADER_MAGIC.length).toString('binary') === cfb.HEADER_MAGIC &&
            prop.value!.slice(-cfb.FOOTER_MAGIC.length).toString('binary') === cfb.FOOTER_MAGIC
        ) {
            console.log('Value could be a CFLBinaryPList?');
            console.log(argv.json ?
                JSON.stringify(cfb.CFLBinaryPListParser.parse(prop.value!), null, 4) :
                cfb.CFLBinaryPListParser.parse(prop.value!));
        }

        const BPLIST_HEADER = 'bplist';
        if (prop.value!.length > BPLIST_HEADER.length &&
            prop.value!.slice(0, BPLIST_HEADER.length).toString('binary') === BPLIST_HEADER
        ) {
            const {parseBuffer: parseBPList} = await import('bplist-parser');
            console.log('Value could be a binary plist?');
            console.log(argv.json ?
                JSON.stringify(parseBPList(prop.value!), null, 4) :
                parseBPList(prop.value!));
        }

        if (prop.value!.length === 4) {
            console.log('Value could be a 32 bit integer?', prop.value!.readUInt32BE(0));
            console.log('Value could be an IPv4 address?', ValueFormatters.ip4(prop.value!));
        }

        if (prop.value!.length === 6) {
            console.log('Value could be a MAC address?', ValueFormatters.mac(prop.value!));
        }

        if (prop.value!.length === 16) {
            console.log('Value could be an IPv6 address?', ValueFormatters.ip6(prop.value!));
        }
    }
}));

interface SetPropArguments {
    prop: PropName;
    value: string;
    json: boolean;
    encryption: boolean;
}

yargs.command('setprop <prop> <value>', 'Set an ACP property', yargs => {
    yargs.positional('prop', {
        describe: 'The name of the ACP property',
    }).positional('value', {
        describe: 'The new value',
    });
    yargs.option('json', {
        describe: 'Whether to parse the value as JSON before setting it',
        default: false,
        type: 'boolean',
    });
    yargs.option('encryption', {
        describe: 'Whether to encrypt connections to the AirPort device',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv: GlobalArguments & SetPropArguments) => {
    const value = argv.json ? JSON.parse(argv.value, reviver) : argv.value;
    const props = await client.setProperties([new Property(argv.prop, value)]);

    console.log(props);
}));

function reviver(key: string, value: any) {
    if (typeof value === 'object') {
        const keys = Object.keys(value);

        if (keys.length === 2 && keys.includes('type') && keys.includes('data') && value.type === 'Buffer') return Buffer.from(value.data);
    }

    return value;
}

yargs.command('features', 'Get supported features', yargs => {
    yargs.option('encryption', {
        describe: 'Whether to encrypt connections to the AirPort device',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv: ClientCommandArguments) => {
    const features = await client.getFeatures();

    console.log(features);
}));

yargs.command('reboot', 'Reboot', yargs => {
    yargs.option('encryption', {
        describe: 'Whether to encrypt connections to the AirPort device',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv: ClientCommandArguments) => {
    await client.reboot();
}));

interface FirmwareCommandArguments extends GlobalArguments {
    input: string;
    output: string;
    mode: 'stream' | 'buffer';
}

yargs.command('firmware-decrypt <input> <output>', 'Decrypt firmware file', yargs => {
    yargs.positional('input', {
        describe: 'Firmware file to decrypt',
    });
    yargs.positional('output', {
        describe: 'Path to write the decrypted firmware file',
    });

    yargs.option('mode', {
        describe: 'Whether to read the whole file (buffer) or use streams (stream)',
        type: 'string',
        default: 'stream',
    });
}, async (argv: FirmwareCommandArguments) => {
    const {createReadStream, createWriteStream, promises: {readFile, writeFile}} = await import('fs');
    const {parse} = await import('../lib/firmware');
    const {default: pump} = await import('pump');

    if (argv.mode === 'buffer') {
        const encrypted = await readFile(argv.input);
        const decrypted = parse(encrypted);
        await writeFile(argv.output, decrypted);
    } else {
        await new Promise((rs, rj) => pump([
            createReadStream(argv.input),
            parse(),
            createWriteStream(argv.output),
        ], err => err ? rj(err) : rs()));
    }
});

yargs.command('firmware-extract <input> <output>', 'Extract gzimg from a firmware file', yargs => {
    yargs.positional('input', {
        describe: 'Decrypted firmware file to extract',
    });
    yargs.positional('output', {
        describe: 'Path to write the extracted gzimg',
    });

    yargs.option('mode', {
        describe: 'Whether to read the whole file (buffer) or use streams (stream)',
        type: 'string',
        default: 'stream',
    });
}, async (argv: FirmwareCommandArguments) => {
    const {createReadStream, createWriteStream, promises: {readFile, writeFile}} = await import('fs');
    const {extract} = await import('../lib/firmware');
    const {default: pump} = await import('pump');

    if (argv.mode === 'buffer') {
        const decrypted = await readFile(argv.input);
        const decompressed = await extract(decrypted);
        await writeFile(argv.output, decompressed);
    } else {
        await new Promise((rs, rj) => pump([
            createReadStream(argv.input),
            extract(),
            createWriteStream(argv.output),
        ], err => err ? rj(err) : rs()));
    }
});

// eslint-disable-next-line no-unused-vars
const argv = yargs.argv as unknown as GlobalArguments;
require('..').loglevel = argv.log;
