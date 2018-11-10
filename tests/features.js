
const {default: Client} = require('..');

const client = new Client('192.168.2.251', 5009, 'testing');

(async () => {
    await client.connect();

    console.log('Connected to', client.host, client.port);

    const features = await client.getFeatures();
    console.log('Features', features);

    process.exit();
})();
