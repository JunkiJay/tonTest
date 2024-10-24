const nacl$1 = require('tweetnacl');

class SessionCrypto {
    constructor(keyPair) {
        this.nonceLength = 24;
        this.keyPair = keyPair ? this.createKeypairFromString(keyPair) : this.createKeypair();
        this.sessionId = this.toHexString(this.keyPair.publicKey);
        this.app_public_key = undefined;
    }

    hexToByteArray(hexString) {
        if (hexString.length % 2 !== 0) {
            throw new Error(`Cannot convert ${hexString} to bytesArray`);
        }
        const result = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < hexString.length; i += 2) {
            result[i / 2] = parseInt(hexString.slice(i, i + 2), 16);
        }
        return result;
    }

    splitToUint8Arrays(array, index) {
        if (index >= array.length) {
            throw new Error('Index is out of buffer');
        }
        const subArray1 = array.slice(0, index);
        const subArray2 = array.slice(index);
        return [subArray1, subArray2];
    }

    toHexString(byteArray) {
        let hexString = '';
        byteArray.forEach(byte => {
            hexString += ('0' + (byte & 0xff).toString(16)).slice(-2);
        });
        return hexString;
    }

    createKeypair() {
        return nacl$1.box.keyPair();
    }
   
    createKeypairFromString(keyPair) {
        return {
            publicKey: this.hexToByteArray(keyPair.publicKey),
            secretKey: this.hexToByteArray(keyPair.secretKey)
        };
    }
    
    createNonce() {
        return nacl$1.randomBytes(this.nonceLength);
    }
    
    concatUint8Arrays(buffer1, buffer2) {
        const mergedArray = new Uint8Array(buffer1.length + buffer2.length);
        mergedArray.set(buffer1);
        mergedArray.set(buffer2, buffer1.length);
        return mergedArray;
    }
    
    encrypt(message, receiverPublicKey) {
        const encodedMessage = new TextEncoder().encode(message);
        const nonce = this.createNonce();
        const encrypted = nacl$1.box(encodedMessage, nonce, receiverPublicKey, this.keyPair.secretKey);
        return this.concatUint8Arrays(nonce, encrypted);
    }

    decrypt(message, senderPublicKey) {
        const [nonce, internalMessage] = this.splitToUint8Arrays(message, this.nonceLength);
        const decrypted = nacl$1.box.open(internalMessage, nonce, senderPublicKey, this.keyPair.secretKey);
        if (!decrypted) {
            throw new Error(`Decryption error: \n message: ${message.toString()} \n sender pubkey: ${senderPublicKey.toString()} \n keypair pubkey: ${this.keyPair.publicKey.toString()} \n keypair secretkey: ${this.keyPair.secretKey.toString()}`);
        }
        return new TextDecoder().decode(decrypted);
    }
    
    stringifyKeypair() {
        return {
            publicKey: this.toHexString(this.keyPair.publicKey),
            secretKey: this.toHexString(this.keyPair.secretKey)
        };
    }
}

module.exports = SessionCrypto;