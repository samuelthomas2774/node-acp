
/**
 * Static key/seed for keystream generation
 */

export const ACP_STATIC_KEY = Buffer.from('5b6faf5d9d5b0e1351f2da1de7e8d673', 'hex').toString('utf8');

export function generateACPKeystream(length) {
    let key = '';
    let key_idx = 0;

    while (key_idx < length) {
        key += String.fromCharCode((key_idx + 0x55 & 0xFF) ^ ACP_STATIC_KEY.charCodeAt(key_idx % ACP_STATIC_KEY.length));
        key_idx++;
    }

    return key;
}
