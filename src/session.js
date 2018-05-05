
// import Encryption from './encryption';
import net from 'net';

export default class Session {

    constructor(host, port, password) {
        this.host = host;
        this.port = port;
        this.password = password;

        this.socket = undefined;
        this.buffer = '';
        this.reading = 0;

        this.encryptionContext = undefined;
        this.encryptionMethod = undefined;
        this.decryptionMethod = undefined;
    }

    connect(_timeout = 10000) {
        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();

            const timeout = setTimeout(() => {
                this.reading -= 1;
                reject('Timeout');
            }, _timeout);

            this.socket.connect(this.port, this.host, err => {
                console.log('Connected', err);
                if (err) reject(err);
                else resolve();
            })

            this.socket.on('close', had_error => {
                this.socket = undefined;
            });

            this.socket.on('data', data => {
                console.debug(0, 'Receiving data', data.toString());
                if (this.reading) return;
                this.buffer += data.toString();
            });
        });
    }

    close() {
        if (!this.socket) return;

        this.socket.end();
        return new Promise((resolve, reject) => {
            this.socket.on('close', resolve);
        });
    }

    async sendAndReceive(data, size, timeout = 10000) {
        await this.send(data);

        data = await this.receiveSize(size, timeout);

        if (this.decryptionMethod)
            data = this.decryptionMethod(data);

        return data;
    }

    send(data) {
        if (this.encryptionMethod)
            data = this.encryptionMethod(data);

        if (!this.socket) return;

        return new Promise((resolve, reject) => {
            console.info(0, 'Sending data', data);
            this.socket.write(data, 'utf-8', err => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    receiveSize(size, _timeout = 10000) {
        const receivedChunks = [this.buffer];
        this.buffer = '';
        this.reading++;
        let receivedSize = this.buffer.length;
        let waitingFor = size - receivedSize;

        let updated = Date.now();
        let timeout;

        return new Promise((resolve, reject) => {
            const defer = () => {
                this.reading -= 1;
                reject('Timeout');
            };

            timeout = setTimeout(defer, _timeout);

            const listener = data => {
                if (data.length > waitingFor) {
                    this.buffer += data.substr(waitingFor);
                    data = data.substr(0, waitingFor);
                }

                receivedChunks.push(data.toString());
                receivedSize += data.toString().length;
                waitingFor = waitingFor - data.toString().length;

                clearTimeout(timeout);

                // console.debug('Receiving data', {
                //     data: data.toString(),
                //     received: receivedChunks,
                //     receivedSize,
                //     waitingFor
                // });

                if (waitingFor <= 0) {
                    this.socket.removeListener('data', listener);
                    this.reading -= 1;
                    resolve(receivedChunks.join(''));
                } else {
                    timeout = setTimeout(defer, _timeout);
                }
            };

            this.socket.on('data', listener);
        });
    }

    async receive(size, timeout = 10000) {
        let data = await this.receiveSize(size, timeout);

        if (this.decryptionMethod)
            data = this.decryptionMethod(data);

        return data;
    }

}

export class ClientSession extends Session {
    enableEncryption(key, client_iv, server_iv) {
        this.encryptionContext = new Encryption(key, client_iv, server_iv);

        this.encryptionMethod = this.encryptionContext.clientEncrypt;
        this.decryptionMethod = this.encryptionContext.serverDecrypt;
    }
}

export class ServerSession extends Session {
    enableEncryption(key, client_iv, server_iv) {
        this.encryptionContext = new Encryption(key, client_iv, server_iv);

        this.encryptionMethod = this.encryptionContext.serverEncrypt;
        this.decryptionMethod = this.encryptionContext.clientDecrypt;
    }
}
