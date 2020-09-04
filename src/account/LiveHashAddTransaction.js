import proto from "@hashgraph/proto";
import Channel from "../Channel";
import Transaction from "../Transaction";
import AccountId from "./AccountId";
import { Key } from "@hashgraph/cryptography";
import { _fromProtoKey, _toProtoKey } from "../util";
import Long from "long";

export default class LiveHashAddTransaction extends Transaction {
    /**
     * @param {object} props
     * @param {Uint8Array} [props.hash]
     * @param {Key[]} [props.keys]
     * @param {number | Long} [props.duration]
     * @param {AccountId | string} [props.accountId]
     */
    constructor(props = {}) {
        super();

        /**
         * @private
         * @type {?Uint8Array}
         */
        this._hash = null;

        /**
         * @private
         * @type {?Key[]}
         */
        this._keys = null;

        /**
         * @private
         * @type {?Long}
         */
        this._duration = null;

        /**
         * @private
         * @type {?AccountId}
         */
        this._accountId = null;

        if (props.hash != null) {
            this.setHash(props.hash);
        }

        if (props.keys != null) {
            this.setKeys(props.keys);
        }

        if (props.duration != null) {
            this.setDuration(props.duration);
        }

        if (props.accountId != null) {
            this.setAccountId(props.accountId);
        }
    }

    /**
     * @internal
     * @param {proto.TransactionBody} body
     * @returns {LiveHashAddTransaction}
     */
    static _fromProtobuf(body) {
        const hashes = /** @type {proto.ICryptoAddLiveHashTransactionBody} */ (body.cryptoAddLiveHash);

        return new LiveHashAddTransaction({
            hash:
                hashes.liveHash?.hash != null
                    ? hashes.liveHash.hash
                    : undefined,
            keys:
                hashes.liveHash?.keys?.keys != null
                    ? hashes.liveHash.keys.keys.map((key) => _fromProtoKey(key))
                    : undefined,
            duration:
                hashes.liveHash?.duration?.seconds != null
                    ? hashes.liveHash.duration?.seconds
                    : undefined,
            accountId:
                hashes.liveHash?.accountId != null
                    ? AccountId._fromProtobuf(hashes.liveHash.accountId)
                    : undefined,
        });
    }

    /**
     * @returns {?Uint8Array}
     */
    getHash() {
        return this._hash;
    }

    /**
     * @param {Uint8Array} hash
     * @returns {LiveHashAddTransaction}
     */
    setHash(hash) {
        this._requireNotFrozen();
        this.hash = hash;

        return this;
    }

    /**
     * @returns {?Key[]}
     */
    getKeys() {
        return this._keys;
    }

    /**
     * @param {Key[]} keys
     * @returns {LiveHashAddTransaction}
     */
    setKeys(...keys) {
        this._requireNotFrozen();
        this.keys = keys;

        return this;
    }

    /**
     * @returns {?Long}
     */
    getDuration() {
        return this._duration;
    }

    /**
     * @param {number | Long} duration
     * @returns {LiveHashAddTransaction}
     */
    setDuration(duration) {
        this._requireNotFrozen();
        this.duration =
            duration instanceof Long ? duration : Long.fromValue(duration);

        return this;
    }

    /**
     * @returns {?AccountId}
     */
    getAccountId() {
        return this._accountId;
    }

    /**
     * @param {AccountId | string} accountId
     * @returns {LiveHashAddTransaction}
     */
    setAccountId(accountId) {
        this._requireNotFrozen();
        this.accountId =
            accountId instanceof AccountId
                ? accountId
                : AccountId.fromString(accountId);

        return this;
    }

    /**
     * @override
     * @protected
     * @param {Channel} channel
     * @returns {(transaction: proto.ITransaction) => Promise<proto.TransactionResponse>}
     */
    _getTransactionMethod(channel) {
        return (transaction) => channel.crypto.addLiveHash(transaction);
    }

    /**
     * @override
     * @protected
     * @returns {proto.TransactionBody["data"]}
     */
    _getTransactionDataCase() {
        return "cryptoAddLiveHash";
    }

    /**
     * @override
     * @protected
     * @returns {proto.ICryptoAddLiveHashTransactionBody}
     */
    _makeTransactionData() {
        return {
            liveHash: {
                hash: this._hash,
                keys:
                    this._keys != null
                        ? {
                              keys: this._keys.map((key) => _toProtoKey(key)),
                          }
                        : undefined,
                duration: {
                    seconds: this._duration,
                },
                accountId: this._accountId?._toProtobuf(),
            },
        };
    }
}
