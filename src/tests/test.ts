
import Client from '../index';

const client = new Client('192.168.2.251', 5009, 'testing');

(async () => {
    await client.connect();

    console.log('Connected to', client.host, client.port);

    try {
        const props = await client.getProperties(['dbug']);
        console.log('Value:', props, props[0].format());
    } catch (err) {
        console.error('Caught error:', err);
    }

    // await client.disconnect();

    process.exit();
})();
