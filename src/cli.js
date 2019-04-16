#!/usr/bin/env node

import Client from './client';
import Server from './server';
import Property from './property';

import yargs from 'yargs';
import bonjour from 'bonjour';

yargs.demandCommand();
yargs.help();

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

yargs.command('version', 'Shows the node-acp version', () => {}, argv => {
    console.log('node-acp v' + require('../package').version);
    console.log('https://gitlab.fancy.org.uk/samuel/node-acp');
});

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
}, async argv => {
    const server = new Server(argv.host || '::', argv.port);

    await server.addUser('admin', argv.password);

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

const commandHandler = handler => async argv => {
    const client = new Client(argv.host || 'airport-base-station.local', argv.port, argv.password);

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

yargs.command('authenticate', 'Authenticate', yargs => {}, commandHandler(async (client, argv) => {
    const data = await client.authenticate();

    console.log('Authenticated!', data);

    console.log('Getting syNm prop');
    const props = await client.getProperties(['syNm']);

    console.log(props[0].format());
}));

yargs.command('getprop <prop>', 'Get an ACP property', yargs => {
    yargs.positional('prop', {
        describe: 'The name of the ACP property',
    });
    yargs.option('encryption', {
        describe: 'Whether to encrypt connections to the AirPort device',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv) => {
    const props = await client.getProperties([argv.prop]);

    console.log(props[0].format());
}));

yargs.command('setprop <prop> <value>', 'Set an ACP property', yargs => {
    yargs.positional('prop', {
        describe: 'The name of the ACP property',
    }).positional('value', {
        describe: 'The new value',
    });
    yargs.option('encryption', {
        describe: 'Whether to encrypt connections to the AirPort device',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv) => {
    const props = await client.setProperties([new Property(argv.prop, argv.value)]);

    console.log(props);
}));

yargs.command('features', 'Get supported features', yargs => {
    yargs.option('encryption', {
        describe: 'Whether to encrypt connections to the AirPort device',
        default: true,
        type: 'boolean',
    });
}, commandHandler(async (client, argv) => {
    const features = await client.getFeatures();

    console.log(features);
}));

// eslint-disable-next-line no-unused-vars
const argv = yargs.argv;
