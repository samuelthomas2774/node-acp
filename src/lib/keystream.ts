
/**
 * Static key/seed for keystream generation
 */

export const ACP_STATIC_KEY = Buffer.from('5b6faf5d9d5b0e1351f2da1de7e8d673', 'hex');

export function generateACPKeystream(length: number) {
    const key = Buffer.alloc(length);
    let idx = 0;

    while (idx < length) {
        key[idx] = (idx + 0x55 & 0xFF) ^
            ACP_STATIC_KEY[idx % ACP_STATIC_KEY.length];

        idx++;
    }

    return key;
}
