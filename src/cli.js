#!/usr/bin/env node

import Client from './client';
import Property from './property';

import yargs from 'yargs';

yargs.demandCommand();
yargs.help();

yargs.option('host', {
    alias: 'h',
    describe: 'The hostname/IP address of the AirPort device to connect to',
    default: 'airport-base-station.local',
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
});

async function getClient(argv) {
    const client = new Client(argv.host, argv.port, argv.password);

    await client.connect();

    return client;
}

const commandHandler = handler => async argv => {
    const client = new Client(argv.host, argv.port, argv.password);

    try {
        await client.connect();

        await handler.call(undefined, client, argv);
    } catch (err) {
        console.error(err);
    }

    await client.disconnect();
    process.exit();
};

yargs.command('getprop <prop>', 'Get an ACP property', yargs => {
    yargs.positional('prop', {
        describe: 'The name of the ACP property',
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
}, commandHandler(async (client, argv) => {
    const props = await client.setProperties([new Property(argv.prop, argv.value)]);

    console.log(props);
}));

const argv = yargs.argv;
