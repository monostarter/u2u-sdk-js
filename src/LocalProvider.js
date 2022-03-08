import Client from "./client/NodeClient.js";
import Provider from "./Provider.js";
import AccountBalanceQuery from "./account/AccountBalanceQuery.js";
import AccountInfoQuery from "./account/AccountInfoQuery.js";
import AccountRecordsQuery from "./account/AccountRecordsQuery.js";
import TransactionReceiptQuery from "./transaction/TransactionReceiptQuery.js";

/**
 * @typedef {import("./LedgerId.js").default} LedgerId
 * @typedef {import("./Key.js").default} Key
 * @typedef {import("./transaction/Transaction.js").default} Transaction
 * @typedef {import("./transaction/TransactionId.js").default} TransactionId
 * @typedef {import("./transaction/TransactionResponse.js").default} TransactionResponse
 * @typedef {import("./transaction/TransactionReceipt.js").default} TransactionReceipt
 * @typedef {import("./transaction/TransactionRecord.js").default} TransactionRecord
 * @typedef {import("./account/AccountId.js").default} AccountId
 * @typedef {import("./account/AccountBalance.js").default} AccountBalance
 * @typedef {import("./account/AccountInfo.js").default} AccountInfo
 */

/**
 * @template {any} O
 * @typedef {import("./query/Query.js").default<O>} Query<O>
 */

/**
 * @template RequestT
 * @template ResponseT
 * @template OutputT
 * @typedef {import("./Executable.js").default<RequestT, ResponseT, OutputT>} Executable<RequestT, ResponseT, OutputT>
 */

export default class LocalProvider extends Provider {
    constructor() {
        super();

        if (process.env.HEDERA_NETWORK == null) {
            throw new Error(
                "LocalProvider requires the `HEDERA_NETWORK` environment variable to be set"
            );
        }

        this._client = Client.forName(process.env.HEDERA_NETWORK);
    }

    /**
     * @returns {LedgerId?}
     */
    getLedgerId() {
        return this._client.ledgerId;
    }

    /**
     * @returns {{[key: string]: (string | AccountId)}}
     */
    getNetwork() {
        return this._client.network;
    }

    /**
     * @returns {string[]}
     */
    getMirrorNetwork() {
        return this._client.mirrorNetwork;
    }

    /**
     * @param {AccountId | string} accountId
     * @returns {Promise<AccountBalance>}
     */
    getAccountBalance(accountId) {
        return new AccountBalanceQuery()
            .setAccountId(accountId)
            .execute(this._client);
    }

    /**
     * @param {AccountId | string} accountId
     * @returns {Promise<AccountInfo>}
     */
    getAccountInfo(accountId) {
        return new AccountInfoQuery()
            .setAccountId(accountId)
            .execute(this._client);
    }

    /**
     * @param {AccountId | string} accountId
     * @returns {Promise<TransactionRecord[]>}
     */
    getAccountRecords(accountId) {
        return new AccountRecordsQuery()
            .setAccountId(accountId)
            .execute(this._client);
    }

    /**
     * @param {TransactionId | string} transactionId
     * @returns {Promise<TransactionReceipt>}
     */
    getTransactionReceipt(transactionId) {
        return new TransactionReceiptQuery()
            .setTransactionId(transactionId)
            .execute(this._client);
    }

    /**
     * @param {TransactionResponse} response
     * @returns {Promise<TransactionReceipt>}
     */
    waitForReceipt(response) {
        return new TransactionReceiptQuery()
            .setNodeAccountIds([response.nodeId])
            .setTransactionId(response.transactionId)
            .execute(this._client);
    }

    /**
     * @template RequestT
     * @template ResponseT
     * @template OutputT
     * @param {Executable<RequestT, ResponseT, OutputT>} request
     * @returns {Promise<OutputT>}
     */
    sendRequest(request) {
        return request.execute(this._client);
    }
}