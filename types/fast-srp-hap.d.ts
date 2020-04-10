declare namespace srp {
    interface SrpParams {
        N_length_bits: number;
        N: jsbn.BigInteger;
        g: jsbn.BigInteger;
        hash: string;
    }
    const params: {
        [n: string]: SrpParams;
    };

    function computeVerifier(params: SrpParams, salt: Buffer, I: Buffer, P: Buffer): Buffer;

    type GenKeyCallback = (err: Error | null, data: Buffer | null) => void;
    function genKey(callback: GenKeyCallback): void;
    function genKey(bytes: number, callback: GenKeyCallback): void;

    /**
     * SRP client.
     */
    class Client {
        /**
         * Create an SRP client.
         *
         * @param {object} params Group parameters, with .N, .g, .hash
         * @param {Buffer} salt_buf User salt (from server)
         * @param {Buffer} identity_buf Identity/username
         * @param {Buffer} password_buf Password
         * @param {Buffer} secret1_buf Client private key {@see genKey}
         */
        constructor(params: SrpParams, salt_buf: Buffer, identity_buf: Buffer, password_buf: Buffer, secret1_buf: Buffer);
        /**
         * Returns the client's public key (A).
         *
         * @return {Buffer}
         */
        computeA(): Buffer;
        /**
         * Sets the server's public key (B).
         *
         * @param {Buffer} B_buf The server's public key
         */
        setB(B_buf: Buffer): void;
        /**
         * Gets the M1 value.
         * This requires setting the server's public key {@see Client.setB}.
         *
         * @return {Buffer}
         */
        computeM1(): Buffer;
        /**
         * Checks the server was able to calculate M2.
         * This requires setting the server's public key {@see Client.setB}.
         *
         * @param M2 The server's M2 value
         */
        checkM2(M2: Buffer): void;
        /**
         * Returns the shared session key.
         *
         * @return {Buffer}
         */
        computeK(): Buffer;
    }

    /**
     * SRP server.
     */
    class Server {
        constructor(params: SrpParams, salt_buf: Buffer, identity_buf: Buffer, password_buf: Buffer, secret2_buf: Buffer);
        /**
         * Returns the server's public key (B).
         *
         * @return {Buffer}
         */
        computeB(): Buffer;
        /**
         * Sets the client's public key (A).
         *
         * @param {Buffer} A The client's public key
         */
        setA(A: Buffer): void;
        /**
         * Checks the client was able to calculate M1.
         *
         * @param {Buffer} M1 The client's M1 value
         */
        checkM1(M1: Buffer): void;
        /**
         * Returns the shared session key.
         *
         * @return {Buffer}
         */
        computeK(): Buffer;
        /**
         * Gets the M2 value.
         * This requires setting the client's public key {@see Server.setA}.
         *
         * @return {Buffer}
         */
        computeM2(): Buffer;
    }
}

declare namespace jsbn {
    /**
     * BigInteger.
     */
    class BigInteger {
        constructor(number: number | string, base?: number);
        constructor(number: Buffer);
        constructor(number: unknown);

        toString(base?: number): string;
        toBuffer(trimOrSize?: true | number): Buffer;

        compareTo(a: BigInteger): number;

        multiply(b: BigInteger): BigInteger;

        add(b: BigInteger | number): BigInteger;
        subtract(b: BigInteger): BigInteger;

        modPow(b: BigInteger, N: BigInteger): BigInteger;
        mod(b: BigInteger): BigInteger;

        bitLength(): number;
    }
}

declare module 'fast-srp-hap' {
    export = srp;
}

declare module 'fast-srp-hap/lib/jsbn' {
    export = jsbn.BigInteger;
}
