
const adler32 = require('adler32');
const {default: Client} = require('..');

const client = new Client('192.168.2.251', 5009, 'testing');

(async () => {
    await client.connect();

    console.log('Connected to', client.host, client.port);

    try {
        const value = await client.getProperties(['dbug']);
        console.log('Value:', value);
    } catch (err) {
        console.error('Caught error:', err);
    }

    // await client.disconnect();

    process.exit();
})();
