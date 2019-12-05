
import {LogLevel, loglevel} from '..';
import {parse, extract} from '../lib/firmware';
import {createReadStream, createWriteStream, promises as fs} from 'fs';
import pump from 'pump';
import yargs from 'yargs';

yargs.demandCommand();
yargs.help();

interface GlobalArguments {
    log: LogLevel;
}

yargs.option('log', {
    decribe: 'Log level',
    type: 'number',
    default: loglevel,
});

yargs.command('version', 'Shows the node-acp version', () => {}, argv => {
    console.log('node-acp v' + require('../../package').version);
    console.log('https://gitlab.fancy.org.uk/samuel/node-acp');
});

interface FirmwareCommandArguments extends GlobalArguments {
    input: string;
    output: string;
    mode: 'stream' | 'buffer';
}

yargs.command('decrypt <input> <output>', 'Decrypt firmware file', yargs => {
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
    if (argv.mode === 'buffer') {
        const encrypted = await fs.readFile(argv.input);
        const decrypted = parse(encrypted);
        await fs.writeFile(argv.output, decrypted);
    } else {
        await new Promise((rs, rj) => pump([
            createReadStream(argv.input),
            parse(),
            createWriteStream(argv.output),
        ], err => err ? rj(err) : rs()));
    }
});

yargs.command('extract <input> <output>', 'Extract gzimg from a firmware file', yargs => {
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
    if (argv.mode === 'buffer') {
        const decrypted = await fs.readFile(argv.input);
        const decompressed = await extract(decrypted);
        await fs.writeFile(argv.output, decompressed);
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
