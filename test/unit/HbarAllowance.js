import { expect } from "chai";

import { U2UAllowance, AccountId, U2U } from "../../src/index.js";

describe("U2UAllowance", function () {
    it("toProtobuf()", function () {
        const ownerAccountId = new AccountId(3);
        const spenderAccountId = new AccountId(4);
        const hbarAmount = U2U.fromTinyU2U(100);

        const allowance = new U2UAllowance({
            ownerAccountId,
            spenderAccountId,
            amount: hbarAmount,
        });

        expect(allowance._toProtobuf()).to.deep.equal({
            owner: ownerAccountId._toProtobuf(),
            spender: spenderAccountId._toProtobuf(),
            amount: hbarAmount.toTinybars(),
        });
    });
});
