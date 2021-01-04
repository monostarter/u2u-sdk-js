import PrivateKey from "./PrivateKey.js";
import BadMnemonicError from "./BadMnemonicError.js";
import BadMnemonicReason from "./BadMnemonicReason.js";
import legacyWords from "./words/legacy.js";
import bip39Words from "./words/bip39.js";
import BigNumber from "bignumber.js";
import * as sha256 from "./primitive/sha256.js";
import * as pbkdf2 from "./primitive/pbkdf2.js";
import nacl from "tweetnacl";
import * as hmac from "./primitive/hmac.js";
import * as slip10 from "./primitive/slip10.js";

/**
 * Multi-word mnemonic phrase (BIP-39).
 *
 * Compatible with the official Hedera mobile
 * wallets (24-words or 22-words) and BRD (12-words).
 */
export default class Mnemonic {
    /**
     * @param {Object} props
     * @param {string[]} props.words
     * @param {boolean} props.legacy
     * @throws {BadMnemonicError}
     * @hideconstructor
     * @private
     */
    constructor({ words, legacy }) {
        this.words = words;
        this._isLegacy = legacy;
    }

    /**
     * Returns a new random 24-word mnemonic from the BIP-39
     * standard English word list.
     *
     * @returns {Promise<Mnemonic>}
     */
    static generate() {
        return Mnemonic._generate(24);
    }

    /**
     * Returns a new random 12-word mnemonic from the BIP-39
     * standard English word list.
     *
     * @returns {Promise<Mnemonic>}
     */
    static generate12() {
        return Mnemonic._generate(12);
    }

    /**
     * @param {number} length
     * @returns {Promise<Mnemonic>}
     */
    static async _generate(length) {
        // only 12-word or 24-word lengths are supported
        let neededEntropy;

        if (length === 12) neededEntropy = 16;
        else if (length === 24) neededEntropy = 32;
        else {
            throw new Error(
                `unsupported phrase length ${length}, only 12 or 24 are supported`
            );
        }

        // inlined from (ISC) with heavy alternations for modern crypto
        // https://github.com/bitcoinjs/bip39/blob/8461e83677a1d2c685d0d5a9ba2a76bd228f74c6/ts_src/index.ts#L125
        const entropy = nacl.randomBytes(neededEntropy);
        const entropyBits = bytesToBinary(Array.from(entropy));
        const checksumBits = await deriveChecksumBits(entropy);
        const bits = entropyBits + checksumBits;
        const chunks = bits.match(/(.{1,11})/g);

        const words = (chunks != null ? chunks : []).map(
            (binary) => bip39Words[binaryToByte(binary)]
        );

        return new Mnemonic({ words, legacy: false });
    }

    /**
     * Construct a mnemonic from a list of words. Handles 12, 22 (legacy), and 24 words.
     *
     * An exception of BadMnemonicError will be thrown if the mnemonic
     * contains unknown words or fails the checksum. An invalid mnemonic
     * can still be used to create private keys, the exception will
     * contain the failing mnemonic in case you wish to ignore the
     * validation error and continue.
     *
     * @param {string[]} words
     * @throws {BadMnemonicError}
     * @returns {Promise<Mnemonic>}
     */
    static async fromWords(words) {
        return await new Mnemonic({
            words,
            legacy: words.length === 22,
        })._validate();
    }

    /**
     * Recover a private key from this mnemonic phrase, with an
     * optional passphrase.
     *
     * @param {string} [passphrase]
     * @returns {Promise<PrivateKey>}
     */
    async toPrivateKey(passphrase = "") {
        if (this._isLegacy) {
            if (passphrase.length > 0) {
                throw new Error(
                    "legacy 22-word mnemonics do not support passphrases"
                );
            }

            return this._toLegacyPrivateKey();
        }

        return await this._toPrivateKey(passphrase);
    }

    /**
     * Recover a mnemonic phrase from a string, splitting on spaces. Handles 12, 22 (legacy), and 24 words.
     *
     * @param {string} mnemonic
     * @returns {Promise<Mnemonic>}
     */
    static async fromString(mnemonic) {
        return Mnemonic.fromWords(mnemonic.split(/\s|,/));
    }

    /**
     * @returns {Promise<Mnemonic>}
     * @private
     */
    async _validate() {
        // Validate that this is a valid BIP-39 mnemonic
        // as generated by BIP-39's rules.

        // Technically, invalid mnemonics can still be used to generate valid private keys,
        // but if they became invalid due to user error then it will be difficult for the user
        // to tell the difference unless they compare the generated keys.

        // During validation, the following conditions are checked in order

        //  1)) 24 or 12 words

        //  2) All strings in {@link this.words} exist in the BIP-39
        //     standard English word list (no normalization is done)

        //  3) The calculated checksum for the mnemonic equals the
        //     checksum encoded in the mnemonic

        if (this._isLegacy) {
            if (this.words.length !== 22) {
                throw new BadMnemonicError(
                    this,
                    BadMnemonicReason.BadLength,
                    []
                );
            }

            const unknownWordIndices = this.words.reduce(
                (/** @type {number[]} */ unknowns, word, index) =>
                    legacyWords.includes(word.toLowerCase())
                        ? unknowns
                        : [...unknowns, index],
                []
            );

            if (unknownWordIndices.length > 0) {
                throw new BadMnemonicError(
                    this,
                    BadMnemonicReason.UnknownWords,
                    unknownWordIndices
                );
            }

            const [entropy, checksum] = this._toLegacyEntropy();
            const newChecksum = _crc8(entropy);

            if (checksum !== newChecksum) {
                throw new BadMnemonicError(
                    this,
                    BadMnemonicReason.ChecksumMismatch,
                    []
                );
            }
        } else {
            if (!(this.words.length === 12 || this.words.length === 24)) {
                throw new BadMnemonicError(
                    this,
                    BadMnemonicReason.BadLength,
                    []
                );
            }

            const unknownWordIndices = this.words.reduce(
                (/** @type {number[]} */ unknowns, word, index) =>
                    bip39Words.includes(word) ? unknowns : [...unknowns, index],
                []
            );

            if (unknownWordIndices.length > 0) {
                throw new BadMnemonicError(
                    this,
                    BadMnemonicReason.UnknownWords,
                    unknownWordIndices
                );
            }

            // FIXME: calculate checksum and compare
            // https://github.com/bitcoinjs/bip39/blob/master/ts_src/index.ts#L112

            const bits = this.words
                .map((word) => {
                    return bip39Words
                        .indexOf(word)
                        .toString(2)
                        .padStart(11, "0");
                })
                .join("");

            const dividerIndex = Math.floor(bits.length / 33) * 32;
            const entropyBits = bits.slice(0, dividerIndex);
            const checksumBits = bits.slice(dividerIndex);
            const entropyBitsRegex = entropyBits.match(/(.{1,8})/g);
            const entropyBytes = /** @type {RegExpMatchArray} */ (entropyBitsRegex).map(
                binaryToByte
            );

            const newChecksum = await deriveChecksumBits(
                Uint8Array.from(entropyBytes)
            );

            if (newChecksum !== checksumBits) {
                throw new BadMnemonicError(
                    this,
                    BadMnemonicReason.ChecksumMismatch,
                    []
                );
            }
        }

        return this;
    }

    /**
     * @private
     * @param {string} passphrase
     * @returns {Promise<PrivateKey>}
     */
    async _toPrivateKey(passphrase = "") {
        const input = this.words.join(" ");
        const salt = `mnemonic${passphrase}`;

        const seed = await pbkdf2.deriveKey(
            hmac.HashAlgorithm.Sha512,
            input,
            salt,
            2048,
            64
        );

        const digest = await hmac.hash(
            hmac.HashAlgorithm.Sha512,
            "ed25519 seed",
            seed
        );

        let keyData = digest.subarray(0, 32);
        let chainCode = digest.subarray(32);

        for (const index of [44, 3030, 0, 0]) {
            ({ keyData, chainCode } = await slip10.derive(
                keyData,
                chainCode,
                index
            ));
        }

        const keyPair = nacl.sign.keyPair.fromSeed(keyData);

        return new PrivateKey(keyPair, chainCode);
    }

    /**
     * @private
     * @returns {Promise<PrivateKey>}
     */
    async _toLegacyPrivateKey() {
        const index = -1;
        const [entropy] = this._toLegacyEntropy();

        const password = new Uint8Array(entropy.length + 8);
        password.set(entropy, 0);

        const view = new DataView(
            password.buffer,
            password.byteOffset + entropy.length,
            8
        );
        view.setInt32(0, index);
        view.setInt32(4, index);

        const salt = Uint8Array.from([0xff]);
        const keyData = await pbkdf2.deriveKey(
            hmac.HashAlgorithm.Sha512,
            password,
            salt,
            2048,
            32
        );

        return PrivateKey.fromBytes(keyData);
    }

    /**
     * @private
     * @returns {[Uint8Array, number]}
     */
    _toLegacyEntropy() {
        const indicies = this.words.map((word) =>
            legacyWords.indexOf(word.toLowerCase())
        );
        const data = _convertRadix(indicies, legacyWords.length, 256, 33);
        const checksum = data[data.length - 1];
        const result = new Uint8Array(data.length - 1);

        for (let i = 0; i < data.length - 1; i += 1) {
            result[i] = data[i] ^ checksum;
        }

        return [result, checksum];
    }

    /**
     * @returns {string}
     */
    toString() {
        return this.words.join(" ");
    }
}

/**
 * @param {Uint8Array} data
 * @returns {number}
 */
function _crc8(data) {
    let crc = 0xff;

    for (let i = 0; i < data.length - 1; i += 1) {
        crc ^= data[i];
        for (let j = 0; j < 8; j += 1) {
            crc = (crc >>> 1) ^ ((crc & 1) === 0 ? 0 : 0xb2);
        }
    }

    return crc ^ 0xff;
}

/**
 * @param {number[]} nums
 * @param {number} fromRadix
 * @param {number} toRadix
 * @param {number} toLength
 * @returns {Uint8Array}
 */
function _convertRadix(nums, fromRadix, toRadix, toLength) {
    let num = new BigNumber(0);

    for (const element of nums) {
        num = num.times(fromRadix);
        num = num.plus(element);
    }

    const result = new Uint8Array(toLength);

    for (let i = toLength - 1; i >= 0; i -= 1) {
        const tem = num.dividedToIntegerBy(toRadix);
        const rem = num.modulo(toRadix);
        num = tem;
        result[i] = rem.toNumber();
    }

    return result;
}

/**
 * @param {string} bin
 * @returns {number}
 */
function binaryToByte(bin) {
    return parseInt(bin, 2);
}

/**
 * @param {number[]} bytes
 * @returns {string}
 */
function bytesToBinary(bytes) {
    return bytes.map((x) => x.toString(2).padStart(8, "0")).join("");
}

/**
 * @param {Uint8Array} entropyBuffer
 * @returns {Promise<string>}
 */
async function deriveChecksumBits(entropyBuffer) {
    const ENT = entropyBuffer.length * 8;
    const CS = ENT / 32;
    const hash = await sha256.digest(entropyBuffer);

    return bytesToBinary(Array.from(hash)).slice(0, CS);
}
