
import Message, {HEADER_SIZE as MESSAGE_HEADER_SIZE} from './message';
import Property, {HEADER_SIZE as ELEMENT_HEADER_SIZE} from './property';
// import {ClientEncryption, ServerEncryption} from './encryption';

import net from 'net';

export default class Session {
    constructor(host, port, password) {
        this.host = host;
        this.port = port;
        this.password = password;

        this.socket = undefined;
        this.buffer = '';
        this.reading = 0;

        this.encryption = undefined;
    }

    connect(_timeout = 10000) {
        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();

            setTimeout(() => {
                this.reading -= 1;
                reject('Timeout');
            }, _timeout);

            this.socket.connect(this.port, this.host, err => {
                console.log('Connected', err);
                if (err) reject(err);
                else resolve();
            });

            this.socket.on('close', had_error => {
                this.socket = undefined;
            });

            this.socket.on('data', data => {
                console.debug(0, 'Receiving data', data);
                if (this.reading) return;
                this.buffer += data.toString('binary');
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

    async receiveMessage(timeout) {
        const raw_header = await this.receiveMessageHeader(timeout);
        const message = await Message.parseRaw(raw_header);

        const data = await this.receive(message.body_size);

        message.body = data;

        return message;
    }

    receiveMessageHeader(timeout) {
        return this.receive(MESSAGE_HEADER_SIZE, timeout);
    }

    receivePropertyElementHeader(timeout) {
        return this.receive(ELEMENT_HEADER_SIZE, timeout);
    }

    async sendAndReceive(data, size, timeout = 10000) {
        await this.send(data);

        return await this.receive(size, timeout);
    }

    send(data) {
        if (!Buffer.isBuffer(data)) {
            data = Buffer.from(data, 'binary');
        }

        if (this.encryption) {
            data = this.encryption.encrypt(data);
        }

        if (!this.socket) return;

        return new Promise((resolve, reject) => {
            console.info(0, 'Sending data', data);
            this.socket.write(data, 'binary', err => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    receiveSize(size, _timeout = 10000) {
        const receivedChunks = [this.buffer.substr(0, size)];
        this.buffer = this.buffer.substr(size);
        this.reading++;
        let receivedSize = receivedChunks[0].length;
        let waitingFor = size - receivedSize;

        if (waitingFor <= 0) {
            return Promise.resolve(receivedChunks.join(''));
        }

        let timeout;

        return new Promise((resolve, reject) => {
            const defer = () => {
                this.reading -= 1;
                reject('Timeout');
            };

            timeout = setTimeout(defer, _timeout);

            const listener = data => {
                data = data.toString('binary');

                if (data.length > waitingFor) {
                    this.buffer += data.substr(waitingFor);
                    data = data.substr(0, waitingFor);
                }

                receivedChunks.push(data);
                receivedSize += data.length;
                waitingFor = waitingFor - data.length;

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

        if (this.encryption) {
            data = this.encryption.decrypt(data);
        }

        return data;
    }

    enableEncryption(key, client_iv, server_iv) {
        this.encryption_context = new ClientEncryption(key, client_iv, server_iv);
    }

    enableServerEncryption(key, client_iv, server_iv) {
        this.encryption_context = new ServerEncryption(key, client_iv, server_iv);
    }
}
