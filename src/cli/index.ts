
import Client, {Property, Monitor, PropName, PropType, LogLevel, loglevel} from '..';
import {ValueFormatters} from '../lib/property';
import * as cfb from '../lib/cflbinary';
import {createAdvertisementData, reviver, replacer} from '../lib/util';
import yargs from 'yargs';
import path from 'path';
import util from 'util';

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
    describe: 'The hostname/IP address of the AirPort base station to connect to',
});
yargs.option('port', {
    describe: 'The port of the AirPort base station\'s acp daemon (you should only need to change this when you need to use port forwarding to access the device)',
    default: 5009,
});
yargs.option('password', {
    alias: 'p',
    describe: 'The device password of the AirPort base station',
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
        type: 'boolean',
        default: true,
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
    const {default: TestServer} = await import('./server');
    const persist = await import('node-persist');

    const storage = persist.create({
        dir: path.resolve(process.cwd(), 'server-data'),
        stringify: data => JSON.stringify(data, replacer, 4) + '\n',
        parse: data => JSON.parse(data, reviver),
    });
    await storage.init();

    const server = new TestServer(argv.host || '::', argv.port, argv.password || 'testing', storage);
    server.properties = await storage.getItem('Properties') || {};

    try {
        await server.listen();
    } catch (err) {
        console.error(err);
    }

    // Leave the server to run

    if (argv.advertise) {
        const mdns = await import('mdns');

        const service = mdns.createAdvertisement(mdns.tcp('airport'), argv.port, {
            name: argv['advertise-name'],
            txtRecord: createAdvertisementData({
                waMA: '00-00-00-00-00-00', // Ethernet MAC address
                raMA: argv['advertise-address'], // 5 GHz Wi-Fi MAC address - this is used to identify devices in AirPort Utility
                raM2: '00-00-00-00-00-00', // 2.4 GHz Wi-Fi MAC address
                raNm: argv['advertise-network'], // Network
                raCh: 1, // 2.4 GHz channel
                rCh2: 36, // 5 GHz channel
                raSt: 0, // Wireless network mode
                raNA: true, // Enable NAT
                syFl: '0x820C', // ?
                syAP: 115, // Model
                syVs: '7.8', // Version
                srcv: '78000.12', // Build
                bjSd: 43, // ?
                // prob: '',
            }),
        });
        service.start();

        console.log('Advertising service', service);
    }
});

interface ClientCommandArguments extends GlobalArguments {
    encryption?: boolean;
}

const commandHandler = <A extends ClientCommandArguments = ClientCommandArguments>(handler: (client: Client, argv: A) => Monitor | undefined | void | Promise<Monitor | undefined | void>) => async (argv: A) => {
    let password = argv.password;

    if (!password) {
        const {default: read} = await import('read');
        const prompt = util.promisify(read);

        password = await prompt({
            prompt: `Password for ${argv.host || 'airport-base-station.local'}: `,
            silent: true,
        });
    }

    const client = new Client(argv.host || 'airport-base-station.local', argv.port, password);

    try {
        await client.connect();

        if (argv.encryption) {
            console.log('Authenticating');
            await client.authenticate();
            console.log('Authenticated!');
        }

        const r = await handler.call(undefined, client, argv);

        // Don't disconnect if we started a monitor session
        if (r instanceof Monitor) return;
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
        describe: 'Whether to encrypt connections to the AirPort base station',
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

yargs.command('dump-debug <path>', 'Get an ACP property', yargs => {
    yargs.positional('path', {
        describe: 'Path to save to',
    });
    yargs.option('encryption', {
        describe: 'Whether to encrypt connections to the AirPort base station',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv: GlobalArguments & DebugDumpArguments) => {
    const {promises: {mkdir, writeFile}} = await import('fs');
    const path = await import('path');

    const [prop] = await client.getProperties(['stat']);
    const data = prop.format();

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

interface DumpPropsArguments {
    list: string;
    all: boolean;
    json: boolean;
    encryption: boolean;
}

yargs.command('dumpprops <list>', 'Attempt to get an list of ACP properties and guess their types', yargs => {
    yargs.positional('list', {
        describe: 'A file containing a list of property names, each on it\'s own line',
    });
    yargs.option('all', {
        describe: 'Request all properties in the list, including those that are already known',
        default: false,
        type: 'boolean',
    });
    yargs.option('json', {
        describe: 'Output value as JSON',
        default: false,
        type: 'boolean',
    });
    yargs.option('encryption', {
        describe: 'Whether to encrypt connections to the AirPort base station',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv: GlobalArguments & DumpPropsArguments) => {
    const {promises: {readFile, writeFile}} = await import('fs');
    const {props: _props} = await import('../lib/property');

    const allpropnames = (await readFile(argv.list, 'utf-8')).trim().split('\n');
    const propnames = allpropnames
        .filter((pn, i) => (argv.all || !_props.find(prop => pn === prop.name)) && allpropnames.indexOf(pn) === i);

    for (const prop of propnames) {
        _props.unshift({
            name: prop,
            type: 'bin',
            description: '',
            validator: undefined,
        });
    }

    const props = await client.getProperties(propnames as PropName[], false);

    for (const prop of props) {
        console.log('Prop %s value:', prop.name, argv.json ? prop.toString() : prop.format());
        await guessPropertyType(prop, argv.json);
    }
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
        describe: 'Whether to encrypt connections to the AirPort base station',
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
        await guessPropertyType(prop, argv.json);
    }
}));

async function guessPropertyType(prop: Property, json = false) {
    if (prop.value!.length >= cfb.HEADER_SIZE + cfb.FOOTER_SIZE + 1 &&
        prop.value!.slice(0, cfb.HEADER_MAGIC.length).toString('binary') === cfb.HEADER_MAGIC &&
        prop.value!.slice(-cfb.FOOTER_MAGIC.length).toString('binary') === cfb.FOOTER_MAGIC
    ) {
        console.log('Value could be a CFLBinaryPList?');
        console.log(json ?
            JSON.stringify(cfb.CFLBinaryPListParser.parse(prop.value!), replacer, 4) :
            cfb.CFLBinaryPListParser.parse(prop.value!));
    }

    const BPLIST_HEADER = 'bplist';
    if (prop.value!.length > BPLIST_HEADER.length &&
        prop.value!.slice(0, BPLIST_HEADER.length).toString('binary') === BPLIST_HEADER
    ) {
        const {parseBuffer: parseBPList} = await import('bplist-parser');
        console.log('Value could be a binary plist?');
        console.log(json ?
            JSON.stringify(parseBPList(prop.value!), replacer, 4) :
            parseBPList(prop.value!));
    }

    if (prop.value!.length === 1) {
        console.log('Value could be a 8 bit integer?', prop.value!.readUIntBE(0, 1));
    }
    if (prop.value!.length === 1 && [0, 1].includes(prop.value![0])) {
        console.log('Value could be a boolean?', ValueFormatters.boo(prop.value!));
    }
    if (prop.value!.length === 2) {
        console.log('Value could be a 16 bit integer?', prop.value!.readUInt16BE(0));
    }

    if (prop.value!.length === 4) {
        console.log('Value could be a 32 bit integer?', prop.value!.readUInt32BE(0));
        console.log('Value could be an IPv4 address?', ValueFormatters.ip4(prop.value!));
    }

    if (prop.value!.length === 6) {
        console.log('Value could be a MAC address?', ValueFormatters.mac(prop.value!));
    }

    if (prop.value!.length === 8) {
        console.log('Value could be a 64 bit integer?', prop.value!.readBigUInt64BE(0));
    }

    if (prop.value!.length === 16) {
        console.log('Value could be an IPv6 address?', ValueFormatters.ip6(prop.value!));
        console.log('Value could be a UUID address?', ValueFormatters.uid(prop.value!));
    }
}

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
        describe: 'Whether to encrypt connections to the AirPort base station',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv: GlobalArguments & SetPropArguments) => {
    const value = argv.json ? JSON.parse(argv.value, reviver) : argv.value;
    const props = await client.setProperties([new Property(argv.prop, value)]);

    console.log(props);
}));

interface MonitorArguments {
    prop?: PropName;
    encryption: boolean;
}

yargs.command('monitor [prop]', 'Monitor an ACP property', yargs => {
    yargs.positional('prop', {
        describe: 'The name of the ACP property',
    });
    yargs.option('encryption', {
        describe: 'Whether to encrypt connections to the AirPort base station',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv: GlobalArguments & MonitorArguments) => {
    const monitor = await client.monitor(argv.prop ? {filters: {[argv.prop]: {}}} : {});

    monitor.on('data', data => {
        console.log('Monitor data', data);
    });

    return monitor;
}));

interface LogsArguments {
    lines: number;
    follow: boolean;
    encryption: boolean;
}

yargs.command('logs', 'Print logs', yargs => {
    yargs.option('lines', {
        alias: 'n',
        describe: 'Number of lines to print',
        default: -1,
        type: 'number',
    });
    yargs.option('follow', {
        alias: 'f',
        describe: 'Follow log data',
        default: false,
        type: 'boolean',
    });
    yargs.option('encryption', {
        describe: 'Whether to encrypt connections to the AirPort base station',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv: GlobalArguments & LogsArguments) => {
    if (argv.lines !== 0) {
        const [logm] = await client.getProperties(['logm']);
        const log = argv.lines >= 1 ? logm.format().trim().split('\n').slice(- argv.lines).join('\n') :
            logm.format().trim();

        console.log(log);
    }

    if (argv.follow) {
        const monitor = await client.monitor({filters: {logm: {}}});

        monitor.on('data', data => {
            if (!('logm' in data)) return;

            console.log(data.logm);
        });

        return monitor;
    }
}));

yargs.command('features', 'Get supported features', yargs => {
    yargs.option('encryption', {
        describe: 'Whether to encrypt connections to the AirPort base station',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv: ClientCommandArguments) => {
    const features = await client.getFeatures();

    console.log(features);
}));

yargs.command('reboot', 'Reboot', yargs => {
    yargs.option('encryption', {
        describe: 'Whether to encrypt connections to the AirPort base station',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv: ClientCommandArguments) => {
    await client.reboot();
}));

interface ACPDataArguments extends GlobalArguments {
    file: string;
}

yargs.command('parsedata <file>', 'Read ACPData.bin files', yargs => {
    yargs.positional('file', {
        describe: 'Path of the ACPData.bin file',
    });
}, async (argv: ACPDataArguments) => {
    const {default: ACPData} = await import('../lib/acpdata');
    const {promises: fs} = await import('fs');

    const data = await ACPData.load(argv.file);

    console.log(data.toJSON());
});

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

const argv = yargs.argv as unknown as GlobalArguments;
require('..').loglevel = argv.log;
