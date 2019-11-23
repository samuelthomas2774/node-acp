node-acp
===

A Node.js implementation of the management protocol of Apple's AirPort devices.

### Requirements

As some properties use 64 bit numbers which are handled with ES2020 BigInts Node.js v10.8 is required.

### Installation

node-acp is published to npm and GitHub Package Respository.

#### Global installation

Install node-acp globally if you want to use the acp command.

```
# From registry.npmjs.com
npm install --global node-acp

# From npm.pkg.github.com
npm install --global --registry https://npm.pkg.github.com @samuelthomas2774/node-acp
```

#### Local installation

Install node-acp locally if you want to use it as a dependency in your project.

```
# From registry.npmjs.com
npm install node-acp
```

```ts
import Client from 'node-acp';

const client = new Client('airport-base-station.local', 5009, 'testing');

await client.connect();
// If you don't call authenticate after connecting control messages will still work but they'll be sent unencrypted
// Basically, always call authenticate and wait for it to complete after connecting
await client.authenticate();

// ...
```

Command line usage
---

### Get a property

```
acp --host airport-base-station.local --password testing getprop syNm
```

### Set a property

```
acp --host airport-base-station.local --password testing setprop syNm "AirPort Base Station"
```

### Get supported features

```
acp --host airport-base-station.local --password testing features

# This doesn't require authentication, but the admin password is required to enable encryption
acp --host airport-base-station.local --no-encryption features
```

### Reboot

```
acp --host airport-base-station.local --password testing reboot
```

### Firmware decryption

```
# Download and validate firmware
curl -o firmware-120-7.9.1.basebinary http://apsu.apple.com/data/120/091-55931-20190530-b543691f-bb62-4017-96ca-288e4b0c8207/7.9.1.basebinary
[ "`cat firmware-120-7.9.1.basebinary | openssl dgst -sha256`" == "b6eb7068ef890ba1cae8cfe17a54be3811b77fe5eb918f3d9fda23b8ff7841d7" ] || exit 1

acp firmware-decrypt firmware-120-7.9.1.basebinary firmware-120-7.9.1-decrypted-1.basebinary
acp firmware-decrypt firmware-120-7.9.1-decrypted-1.basebinary firmware-120-7.9.1-decrypted-2.gzimg
acp firmware-extract firmware-120-7.9.1-decrypted-2.gzimg firmware-120-7.9.1-extracted.img
```
