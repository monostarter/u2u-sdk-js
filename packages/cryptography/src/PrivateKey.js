import nacl from "tweetnacl";
import PublicKey from "./PublicKey";
import Mnemonic from "./Mnemonic";
import { arraysEqual } from "./util";
import { createKeystore, loadKeystore } from "./Keystore";
import BadKeyError from "./BadKeyError";
import * as hex from "./encoding/hex";
import { read as readPem } from "./encoding/pem";
import * as slip10 from "./primitive/slip10";

const derPrefix = "302e020100300506032b657004220420";
const derPrefixBytes = hex.decode(derPrefix);

/**
 * A private key on the Hedera™ network.
 */
export default class PrivateKey {
    /**
     * @hideconstructor
     * @internal
     * @param {nacl.SignKeyPair} keyPair
     * @param {?Uint8Array} chainCode
     */
    constructor(keyPair, chainCode) {
        this._keyPair = keyPair;
        this._chainCode = chainCode;
    }

    /**
     * Generate a random Ed25519 private key.
     *
     * @returns {PrivateKey}
     */
    static generate() {
        // 32 bytes for the secret key
        // 32 bytes for the chain code (to support derivation)
        const entropy = nacl.randomBytes(64);

        console.log("[0].0 =", entropy.subarray(0, 32));
        console.log("[0].1 =", entropy.subarray(32));

        return new PrivateKey(
            nacl.sign.keyPair.fromSeed(entropy.subarray(0, 32)),
            entropy.subarray(32)
        );
    }

    /**
     * Construct a private key from bytes.
     *
     * @param {Uint8Array} bytes
     * @returns {PrivateKey}
     */
    static fromBytes(bytes) {
        switch (bytes.length) {
            case 48:
                // key with prefix
                if (arraysEqual(bytes.subarray(0, 16), derPrefixBytes)) {
                    const keyPair = nacl.sign.keyPair.fromSeed(
                        bytes.subarray(16)
                    );

                    return new PrivateKey(keyPair, null);
                }

                break;

            case 32:
                const keyPair = nacl.sign.keyPair.fromSeed(bytes);
                return new PrivateKey(keyPair, null);

            case 64:
                // priv + pub key
                return new PrivateKey(
                    nacl.sign.keyPair.fromSecretKey(bytes),
                    null
                );

            default:
        }

        throw new BadKeyError(
            `invalid private key length: ${bytes.length} bytes`
        );
    }

    /**
     * Construct a private key from a hex-encoded string.
     *
     * @param {string} privateKey
     * @returns {PrivateKey}
     */
    static fromString(privateKey) {
        return PrivateKey.fromBytes(hex.decode(privateKey));
    }

    /**
     * Recover a private key from a mnemonic phrase (and optionally a password).
     *
     * @param {Mnemonic | string} mnemonic
     * @param {string} [passphrase]
     * @returns {Promise<PrivateKey>}
     */
    static async fromMnemonic(mnemonic, passphrase = "") {
        return (typeof mnemonic === "string"
            ? await Mnemonic.fromString(mnemonic)
            : mnemonic
        ).toPrivateKey(passphrase);
    }

    /**
     * Recover a private key from a keystore, previously created by `.toKeystore()`.
     *
     * This key will _not_ support child key derivation.
     *
     * @param {Uint8Array} keystore
     * @param {string} passphrase
     * @returns {Promise<PrivateKey>}
     * @throws {BadKeyError} If the passphrase is incorrect or the hash fails to validate.
     */
    static async fromKeystore(keystore, passphrase) {
        return new PrivateKey(await loadKeystore(keystore, passphrase), null);
    }

    /**
     * Recover a private key from a pem string; the private key may be encrypted.
     *
     * This method assumes the .pem file has been converted to a string already.
     *
     * If `passphrase` is not null or empty, this looks for the first `ENCRYPTED PRIVATE KEY`
     * section and uses `passphrase` to decrypt it; otherwise, it looks for the first `PRIVATE KEY`
     * section and decodes that as a DER-encoded  private key.
     *
     * @param {string} pem
     * @param {string} [passphrase]
     * @returns {Promise<PrivateKey>}
     */
    static async fromPem(pem, passphrase) {
        return new PrivateKey(await readPem(pem, passphrase), null);
    }

    /**
     * Derive a new private key at the given wallet index.
     *
     * Only currently supported for keys created with `fromMnemonic()`; other keys will throw
     * an error.
     *
     * You can check if a key supports derivation with `.supportsDerivation()`
     *
     * @param {number} index
     * @returns {Promise<PrivateKey>}
     * @throws If this key does not support derivation.
     */
    async derive(index) {
        if (this._chainCode == null) {
            throw new Error("this private key does not support key derivation");
        }

        const { keyData, chainCode } = await slip10.derive(
            this.toBytes(),
            this._chainCode,
            index
        );

        const keyPair = nacl.sign.keyPair.fromSeed(keyData);

        return new PrivateKey(keyPair, chainCode);
    }

    /**
     * Get the public key associated with this private key.
     *
     * The public key can be freely given and used by other parties to verify
     * the signatures generated by this private key.
     *
     * @returns {PublicKey}
     */
    getPublicKey() {
        return PublicKey.fromBytes(this._keyPair.publicKey);
    }

    /**
     * Sign a message with this private key.
     *
     * @param {Uint8Array} bytes
     * @returns {Uint8Array} - The signature bytes without the message
     */
    sign(bytes) {
        return nacl.sign.detached(bytes, this._keyPair.secretKey);
    }

    /**
     * Check if `derive` can be called on this private key.
     *
     * This is only the case if the key was created from a mnemonic.
     *
     * @returns {boolean}
     */
    isDerivable() {
        return this._chainCode != null;
    }

    /**
     * @returns {Uint8Array}
     */
    toBytes() {
        // copy the bytes so they can't be modified accidentally
        return this._keyPair.secretKey.slice(0, 32);
    }

    /**
     * @param {boolean} [raw]
     * @returns {string}
     */
    toString(raw = false) {
        return (raw ? "" : derPrefix) + hex.encode(this.toBytes());
    }

    /**
     * Create a keystore with a given passphrase.
     *
     * The key can be recovered later with `fromKeystore()`.
     *
     * Note that this will not retain the ancillary data used for
     * deriving child keys, thus `.derive()` on the restored key will
     * throw even if this instance supports derivation.
     *
     * @param {string} passphrase
     * @returns {Promise<Uint8Array>}
     */
    toKeystore(passphrase) {
        return createKeystore(this.toBytes(), passphrase);
    }
}
