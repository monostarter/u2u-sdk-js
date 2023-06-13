import {
    FileCreateTransaction,
    FileDeleteTransaction,
    FileUpdateTransaction,
    FileInfoQuery,
    U2U,
    Status,
} from "../../src/exports.js";
import IntegrationTestEnv from "./client/NodeIntegrationTestEnv.js";

describe("FileUpdate", function () {
    let env;

    before(async function () {
        env = await IntegrationTestEnv.new();
    });
    it("should be executable", async function () {
        this.timeout(120000);

        const operatorKey = env.operatorKey.publicKey;

        let response = await new FileCreateTransaction()
            .setKeys([operatorKey])
            .setContents("[e2e::FileCreateTransaction]")
            .execute(env.client);

        let receipt = await response.getReceipt(env.client);

        expect(receipt.fileId).to.not.be.null;
        expect(receipt.fileId != null ? receipt.fileId.num > 0 : false).to.be
            .true;

        const file = receipt.fileId;

        let info = await new FileInfoQuery()
            .setFileId(file)
            .setQueryPayment(new U2U(22))
            .execute(env.client);

        expect(info.fileId.toString()).to.be.equal(file.toString());
        expect(info.size.toInt()).to.be.equal(28);
        expect(info.isDeleted).to.be.false;

        // There should only be one key
        for (const key of info.keys) {
            expect(key.toString()).to.be.equal(operatorKey.toString());
        }

        await (
            await new FileUpdateTransaction()
                .setFileId(file)
                .setContents("[e2e::FileUpdateTransaction]")
                .execute(env.client)
        ).getReceipt(env.client);

        info = await new FileInfoQuery()
            .setFileId(file)
            .setQueryPayment(new U2U(22))
            .execute(env.client);

        expect(info.fileId.toString()).to.be.equal(file.toString());
        expect(info.size.toInt()).to.be.equal(28);
        expect(info.isDeleted).to.be.false;

        // There should only be one key
        for (const key of info.keys) {
            expect(key.toString()).to.be.equal(operatorKey.toString());
        }

        await (
            await new FileDeleteTransaction()
                .setFileId(file)
                .execute(env.client)
        ).getReceipt(env.client);
    });

    it("should error when file ID is not set", async function () {
        this.timeout(120000);

        let err = false;

        try {
            await (
                await new FileUpdateTransaction()
                    .setContents("[e2e::FileUpdateTransaction]")
                    .execute(env.client)
            ).getReceipt(env.client);
        } catch (error) {
            err = error.toString().includes(Status.InvalidFileId);
        }

        if (!err) {
            throw new Error("file update did not error");
        }
    });

    after(async function () {
        await env.close();
    });
});
