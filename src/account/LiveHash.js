import AccountId from "./AccountId.js";
import { KeyList } from "@hashgraph/cryptography";
import Long from "long";
import {
    keyListFromProtobuf,
    keyListToProtobuf,
} from "../cryptography/protobuf.js";

/**
 * @namespace proto
 * @typedef {import("@hashgraph/proto").IAccountID} proto.IAccountID
 * @typedef {import("@hashgraph/proto").ILiveHash} proto.ILiveHash
 */

/**
 * Response when the client sends the node CryptoGetInfoQuery.
 */
export default class LiveHash {
    /**
     * @private
     * @param {object} props
     * @param {AccountId} props.accountId
     * @param {Uint8Array} props.hash
     * @param {KeyList} props.keys
     * @param {number} props.duration
     */
    constructor(props) {
        /** @readonly */
        this.accountId = props.accountId;

        /** @readonly */
        this.hash = props.hash;

        /** @readonly */
        this.keys = props.keys;

        /** @readonly */
        this.duration = props.duration;

        Object.freeze(this);
    }

    /**
     * @internal
     * @param {proto.ILiveHash} liveHash
     * @returns {LiveHash}
     */
    static _fromProtobuf(liveHash) {
        const liveHash_ = /** @type {proto.ILiveHash} */ (liveHash);
        const durationSeconds =
            liveHash_.duration != null
                ? liveHash_.duration.seconds != null
                    ? liveHash_.duration.seconds
                    : 0
                : 0;

        return new LiveHash({
            accountId: AccountId._fromProtobuf(
                /** @type {proto.IAccountID} */ (liveHash_.accountId)
            ),
            hash: liveHash_.hash != null ? liveHash_.hash : new Uint8Array(),
            keys:
                liveHash_.keys != null
                    ? keyListFromProtobuf(liveHash_.keys)
                    : new KeyList(),
            duration:
                durationSeconds instanceof Long
                    ? durationSeconds.toInt()
                    : durationSeconds,
        });
    }

    /**
     * @internal
     * @returns {proto.ILiveHash}
     */
    _toProtobuf() {
        return {
            accountId: this.accountId._toProtobuf(),
            hash: this.hash,
            keys: keyListToProtobuf(this.keys),
            duration: {
                seconds: Long.fromNumber(this.duration),
            },
        };
    }
}
