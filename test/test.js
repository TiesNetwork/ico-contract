const assertJump = require('./helpers/assertJump');
const testRpc = require('./helpers/testRpc');

var UbermenschPreICO = artifacts.require("./UbermenschPreICO.sol");
var UbermenschToken = artifacts.require("./UbermenschToken.sol");

const State = {
    Unknown: 0,
    Preparing: 1,
    PreFunding: 2,
    Funding: 3,
    Success: 4,
    Failure: 5,
    Finalized: 6,
    Refunding: 7
};

const minimumFundingGoal = web3.toWei(100, "Ether");
const tokenDecimals = 8;
const maximumSellableTokens = 1000000000*Math.pow(10, tokenDecimals); //preICO target (cap * token decimals)
const tokenPrice = 0.00125 * web3.toWei(1, "Ether");

function getCurrentTime() {
	return web3.eth.getBlock("latest").timestamp;
}

contract('UbermenschPreICO (if failed)', async function(accounts) {
    let tokenContract, icoContract;
    let startDate = 0;
    let endDate = 0;

    before(async function(){
        tokenContract = await UbermenschToken.new(accounts[0]);

        let now = new Date(getCurrentTime()*1000);
        let start = new Date(now.getFullYear(), now.getMonth()+1, 1);
        startDate = +start/1000;
        endDate = startDate + 10*24*3600; //10 days

        icoContract = await UbermenschPreICO.new(tokenContract.address, accounts[0], startDate, endDate);
        await tokenContract.setMintAgent(icoContract.address, true);

        console.log("    - Deployed new contracts at " + now);
        console.log("    - Default ICO start: " + new Date(startDate*1000) + ", end: " + new Date(endDate*1000));
    });

    it("Should buying fail before start", async () => {
        let instance = icoContract, thrown = false;
        try {
            thrown = false;
            await instance.investBTC(accounts[1], web3.toWei(1, "Ether"));
        } catch(error) {
            thrown = true;
            assertJump(error);
        }
        assert.isOk(thrown, 'investBTC should have thrown');

        try {
            thrown = false;
            await instance.buy({from: accounts[2], value: web3.toWei(1, "Ether")});
        } catch(error) {
            thrown = true;
            assertJump(error);
        }
        assert.isOk(thrown, 'buy should have thrown');
    });

    it("Should verify start date", async () => {
        let instance = icoContract;
        let date = await instance.startsAt.call();
        assert.equal(date.toNumber(), startDate, "Start Date should be equal to " + startDate);
    });

    it("Should be able to start", async () => {
        let instance = icoContract;
        await instance.startEarly();
        let state = await instance.getState();
        assert.equal(state.toNumber(), State.Funding, "We should have started the ICO");
    });

    it("Should be able to buy tokens for BTC", async () => {
        let instance = icoContract;
        let token = tokenContract;
        let buyAmount = web3.toWei(1, "Ether");
        await instance.investBTC(accounts[1], buyAmount); //{from: accounts[1], value: web3.toWei(1, "Ether")}
        let balance = await token.balanceOf(accounts[1]);
        //In first preICO minutes we get 50% bonus for time and 3% for 1 ether sum
        let shouldBe = buyAmount*(1+0.5+0.03)/tokenPrice*Math.pow(10, tokenDecimals);
        assert.equal(balance.toNumber(), shouldBe, "Balance should include valid bonuses");

        let totalBalance = await token.totalSupply.call();
        assert.equal(totalBalance.toNumber(), shouldBe, "Total issued tokens should equal the first issue");

        let invested = await instance.investedAmountOf(accounts[1]);
        assert.equal(invested.toNumber(), 0, "BTC refundable value should equal to 0");
    });

    it("Should be able to buy tokens for Ether", async () => {
        let instance = icoContract;
        let token = tokenContract;

        //Remember previous tokenSupply
        let totalSupply = await token.totalSupply.call();

        let buyAmount = web3.toWei(5, "Ether");
        await instance.buy({from: accounts[2], value: buyAmount});
        let balance = await token.balanceOf(accounts[2]);

        //In first preICO minutes we get 50% bonus for time and 7% for 5 ether sum
        let shouldBe = Math.round(buyAmount*(1+0.5+0.07)/tokenPrice*Math.pow(10, tokenDecimals));
        assert.equal(balance.toNumber(), shouldBe, "Balance should include valid bonuses");

        let investorCount = await instance.investorCount.call();
        assert.equal(investorCount.toNumber(), 2, "There should be 2 investors by now");

        let totalBalance = await token.totalSupply.call();
        assert.equal(totalBalance.toNumber(), shouldBe + totalSupply.toNumber(), "Total issued tokens should be sum of all issues");

        let tokensSold = await instance.tokensSold.call();
        assert.equal(tokensSold.toNumber(), shouldBe + totalSupply.toNumber(), "Sold tokens should be sum of all issued tokens");

        let totalRaised = await instance.weiRaised.call();
        assert.equal(totalRaised.toNumber(), web3.toWei(6, "Ether"), "Total raised should be 6 Ether by now");

        let invested = await instance.investedAmountOf(accounts[2]);
        assert.equal(invested.toNumber(), buyAmount, "Ether funds should be registerd for refund");
    });

    it("Should bonuses degrade with 12h time", async () => {
        let instance = icoContract;
        let token = tokenContract;

        let startsAt = (await instance.startsAt.call()).toNumber();
        //We should skip beyond 12 hours since official start
        let skip = startDate - startsAt + 12*3600 + 300;
        console.log('    - Skipping seconds: ' + skip);
        await testRpc.increaseTime(skip);

        let prevBalance = await instance.tokenAmountOf(accounts[1]);

        let buyAmount = web3.toWei(11, "Ether");
        await instance.buy({from: accounts[1], value: buyAmount});
        let balance = await token.balanceOf(accounts[1]);

        //In first 36 hours of preICO we get 30% bonus for time and 12% for 10 ether sum
        let shouldBe = Math.round(buyAmount*(1+0.3+0.12)/tokenPrice*Math.pow(10, tokenDecimals));
        assert.equal(balance.toNumber() - prevBalance.toNumber(), shouldBe, "Balance should include valid bonuses");
    });

    it("Should bonuses degrade with 36h time", async () => {
        let instance = icoContract;
        let token = tokenContract;

        //We should skip beyond 36 hours since official start
        let skip = 24*3600;
        console.log('    - Skipping seconds: ' + skip);
        await testRpc.increaseTime(skip);

        let prevBalance = await instance.tokenAmountOf(accounts[2]);

        let buyAmount = web3.toWei(50, "Ether");
        await instance.buy({from: accounts[2], value: buyAmount});
        let balance = await token.balanceOf(accounts[2]);

        //In first 36 hours of preICO we get 20% bonus for time and 20% for 50 ether sum
        let shouldBe = Math.round(buyAmount*(1+0.2+0.2)/tokenPrice*Math.pow(10, tokenDecimals));
        assert.equal(balance.toNumber() - prevBalance.toNumber(), shouldBe, "Balance should include valid bonuses");
    });

    it("Should bonuses degrade with 4d time", async () => {
        let instance = icoContract;
        let token = tokenContract;

        //We should skip beyond 4 days since official start
        let skip = 3*24*3600;
        console.log('    - Skipping seconds: ' + skip);
        await testRpc.increaseTime(skip);

        let prevBalance = await instance.tokenAmountOf(accounts[3]);

        let buyAmount = web3.toWei(0.5, "Ether");
        await instance.buy({from: accounts[3], value: buyAmount});
        let balance = await token.balanceOf(accounts[3]);

        //In first 36 hours of preICO we get 10% bonus for time and 0% for 0.5 ether sum
        let shouldBe = Math.round(buyAmount*(1+0.1+0)/tokenPrice*Math.pow(10, tokenDecimals));
        assert.equal(balance.toNumber() - prevBalance.toNumber(), shouldBe, "Balance should include valid bonuses");
    });

    it("Should bonuses degrade with 7d time", async () => {
        let instance = icoContract;
        let token = tokenContract;

        //We should skip beyond 7 days since official start
        let skip = 3*24*3600;
        console.log('    - Skipping seconds: ' + skip);
        await testRpc.increaseTime(skip);

        let prevBalance = await instance.tokenAmountOf(accounts[2]);

        let buyAmount = web3.toWei(1.5, "Ether");
        await instance.buy({from: accounts[2], value: buyAmount});
        let balance = await token.balanceOf(accounts[2]);

        //In first 36 hours of preICO we get 10% bonus for time and 0% for 1.5 ether sum
        let shouldBe = Math.round(buyAmount*(1+0.05+0.03)/tokenPrice*Math.pow(10, tokenDecimals));
        assert.equal(balance.toNumber() - prevBalance.toNumber(), shouldBe, "Balance should include valid bonuses");
    });

    it("Should fail after end", async () => {
        let instance = icoContract;
        let token = tokenContract;

        //We should skip beyond 7 days since official start
        let skip = 3*24*3600;
        console.log('    - Skipping seconds: ' + skip);
        await testRpc.increaseTime(skip);
        await testRpc.mine(); //To set new time to the blockchain

        let state = await instance.getState();
        assert.equal(state.toNumber(), State.Failure, "We should do not have enough");

        let thrown;
        try {
            thrown = false;
            await instance.buy({from: accounts[2], value: web3.toWei(1, "Ether")});
        } catch(error) {
            thrown = true;
            assertJump(error);
        }
        assert.isOk(thrown, 'buy should have thrown');
    });
});

contract('UbermenschPreICO (if succeded)', async function(accounts) {
    let tokenContract, icoContract;
    let startDate = 0;
    let endDate = 0;

    before(async function(){
        tokenContract = await UbermenschToken.new(accounts[0]);

        let now = new Date(getCurrentTime()*1000);
        let start = new Date(now.getFullYear(), now.getMonth()+1, 1);
        startDate = +start/1000;
        endDate = startDate + 10*24*3600; //10 days

        icoContract = await UbermenschPreICO.new(tokenContract.address, accounts[0], startDate, endDate);
        await tokenContract.setMintAgent(icoContract.address, true);
        await tokenContract.setReleaseAgent(accounts[0]);

        console.log("  - Deployed new contracts at " + now);
        console.log("  - Default ICO start: " + new Date(startDate*1000) + ", end: " + new Date(endDate*1000));
    });

    it("Should verify start date", async () => {
        let instance = icoContract;
        let date = await instance.startsAt.call();
        assert.equal(date.toNumber(), startDate, "Start Date should be equal to " + startDate);
    });

    it("Should be able to start", async () => {
        let instance = icoContract;
        await instance.startEarly();
        let state = await instance.getState();
        assert.equal(state.toNumber(), State.Funding, "We should have started the ICO");
    });

    it("Should be able to buy tokens for BTC", async () => {
        let instance = icoContract;
        let token = tokenContract;
        let buyAmount = web3.toWei(50, "Ether");
        await instance.investBTC(accounts[1], buyAmount); //{from: accounts[1], value: web3.toWei(1, "Ether")}
        let balance = await token.balanceOf(accounts[1]);
        //In first preICO minutes we get 50% bonus for time and 20% for 1 ether sum
        let shouldBe = buyAmount*(1+0.5+0.20)/tokenPrice*Math.pow(10, tokenDecimals);
        assert.equal(balance.toNumber(), shouldBe, "Balance should include valid bonuses");

        let totalBalance = await token.totalSupply.call();
        assert.equal(totalBalance.toNumber(), shouldBe, "Total issued tokens should equal the first issue");

        let invested = await instance.investedAmountOf(accounts[1]);
        assert.equal(invested.toNumber(), 0, "BTC refundable value should equal to 0");
    });

    it("Should be able to buy tokens for Ether", async () => {
        let instance = icoContract;
        let token = tokenContract;

        //Remember previous tokenSupply
        let totalSupply = await token.totalSupply.call();

        let buyAmount = web3.toWei(50, "Ether");
        await instance.buy({from: accounts[2], value: buyAmount});
        let balance = await token.balanceOf(accounts[2]);

        //In first preICO minutes we get 50% bonus for time and 20% for 50 ether sum
        let shouldBe = Math.round(buyAmount*(1+0.5+0.20)/tokenPrice*Math.pow(10, tokenDecimals));
        assert.equal(balance.toNumber(), shouldBe, "Balance should include valid bonuses");
    });

    it("Should bonuses degrade with 12h time", async () => {
        let instance = icoContract;
        let token = tokenContract;

        let startsAt = (await instance.startsAt.call()).toNumber();
        //We should skip beyond 12 hours since official start
        let skip = startDate - startsAt + 12*3600 + 300;
        console.log('    - Skipping seconds: ' + skip);
        await testRpc.increaseTime(skip);

        let prevBalance = await instance.tokenAmountOf(accounts[3]);

        let buyAmount = web3.toWei(50, "Ether");
        await instance.buy({from: accounts[3], value: buyAmount});
        let balance = await token.balanceOf(accounts[3]);

        //In first 36 hours of preICO we get 30% bonus for time and 20% for 50 ether sum
        let shouldBe = Math.round(buyAmount*(1+0.3+0.20)/tokenPrice*Math.pow(10, tokenDecimals));
        assert.equal(balance.toNumber() - prevBalance.toNumber(), shouldBe, "Balance should include valid bonuses");
    });

    it("Should tokens be locked during ICO", async () => {
        let thrown;
        try {
            thrown = !await tokenContract.transfer(accounts[2], 5 * (10 ** tokenDecimals));
        } catch(error) {
            thrown = true;
            assertJump(error);
        }
        assert.isOk(thrown, 'transfer should have failed');
    });

    it("Should succeed after end", async () => {
        let instance = icoContract;
        let token = tokenContract;

        //We should skip beyond 7 days since official start
        let skip = 10*24*3600;
        console.log('    - Skipping seconds: ' + skip);
        await testRpc.increaseTime(skip);
        await testRpc.mine(); //To set new time to the blockchain

        let state = await instance.getState();
        assert.equal(state.toNumber(), State.Success, "We should have reached minimum goal");

        let thrown;
        try {
            thrown = false;
            await instance.buy({from: accounts[2], value: web3.toWei(1, "Ether")});
        } catch(error) {
            thrown = true;
            assertJump(error);
        }
        assert.isOk(thrown, 'buy should have thrown');
    });

    it("Should tokens be locked after successful ICO", async () => {
        let thrown;
        try {
            thrown = !await tokenContract.transfer(accounts[2], 5 * (10 ** tokenDecimals));
        } catch(error) {
            thrown = true;
            assertJump(error);
        }
        assert.isOk(thrown, 'transfer should have failed');
    });

    it("Should be able to release tokens", async () => {
        await tokenContract.releaseTokenTransfer();
        assert(true, 'tokens are released');
    });

    it("Should be able to transfer tokens", async () => {
        let balanceOld = await tokenContract.balanceOf(accounts[2]);
        let value = 5 * (10 ** tokenDecimals);
        let ok = await tokenContract.transfer(accounts[2], value, {from: accounts[1]});
        assert.isOk(ok, 'transfer should have been successful');
        let balance = await tokenContract.balanceOf(accounts[2]);
        assert.equal(value, balance.toNumber() - balanceOld.toNumber(), 'recepient should have received the exact amount sent');
    });

    it("Should not be able to transfer more than one has", async () => {
        let balanceOld = await tokenContract.balanceOf(accounts[2]);
        let thrown;
        try {
            thrown = !await tokenContract.transfer(accounts[3], balanceOld.toNumber() + 1, {from: accounts[2]});
        } catch(error) {
            thrown = true;
            assertJump(error);
        }
        assert.isOk(thrown, 'transfer should have thrown');
    });

});
