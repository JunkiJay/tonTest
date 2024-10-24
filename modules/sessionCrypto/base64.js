const nacl = require('tweetnacl-util');

function encodeUint8Array(value, urlSafe) {
    const encoded = nacl.encodeBase64(value);
    if (!urlSafe) {
        return encoded;
    }
    return encodeURIComponent(encoded);
}

function decodeToUint8Array(value, urlSafe) {
    if (urlSafe) {
        value = decodeURIComponent(value);
    }
    return nacl.decodeBase64(value);
}

function encode(value, urlSafe = false) {
    let uint8Array;
    if (value instanceof Uint8Array) {
        uint8Array = value;
    }
    else {
        if (typeof value !== 'string') {
            value = JSON.stringify(value);
        }
        uint8Array = nacl.decodeUTF8(value);
    }
    return encodeUint8Array(uint8Array, urlSafe);
}


function decode(value, urlSafe = false) {
    const decodedUint8Array = decodeToUint8Array(value, urlSafe);
    return {
        toString() {
            return nacl.encodeUTF8(decodedUint8Array);
        },
        toObject() {
            try {
                return JSON.parse(nacl.encodeUTF8(decodedUint8Array));
            }
            catch (e) {
                return null;
            }
        },
        toUint8Array() {
            return decodedUint8Array;
        }
    };
}
const Base64 = {
    encode,
    decode
};

module.exports = Base64;