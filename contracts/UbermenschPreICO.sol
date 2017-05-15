pragma solidity ^0.4.8;

import "./UbermenschToken.sol";
import "ico/MintedTokenCappedCrowdsale.sol";
import "ico/PricingStrategy.sol";


/// @title UbermenschICO contract - Takes funds from users and issues tokens.
/// @author Dmitry Kochin - <k@ubermensch.com>
contract Constants {
    // Start date of the ICO
    uint constant public startDate = 1498863600;  // 2017-06-30 23:00:00 UTC
    uint constant public endDate = 1499641200;  // 2017-07-09 23:00:00 UTC
    uint constant public minimumFundingGoal = 100 ether;
    uint constant public tokenDecimals = 8;
    uint constant public maximumSellableTokens = uint(1000000000)*(10 ** tokenDecimals); //preICO target (cap * token decimals)
    uint constant public tokenPrice = 0.00125 * 1 ether;
}


contract UbermenschPreICOPricingStrategy is PricingStrategy, Constants{
    uint private startsAt;

    function UbermenschPreICOPricingStrategy(uint officialStartDate){
        startsAt = officialStartDate;
    }

    /**
     * When somebody tries to buy tokens for X eth, calculate how many tokens they get.
     *
     *
     * @param value - What is the value of the transaction send in as wei
     * @param tokensSold - how much tokens have been sold this far
     * @param weiRaised - how much money has been raised this far
     * @param msgSender - who is the investor of this transaction
     * @param decimals - how many decimal units the token has
     * @return Amount of tokens the investor receives
     */
    function calculatePrice(uint value, uint tokensSold, uint weiRaised, address msgSender, uint decimals) public constant returns (uint tokenAmount){
        int time_passed = int(now) - int(startsAt);
        uint bonus = 0;
        //Value bonus
        if(value >= 50 ether){
            bonus += 20;
        }else if(value >= 10 ether){
            bonus += 12;
        }else if(value >= 5 ether){
            bonus += 7;
        }else if(value >= 1 ether){
            bonus += 3;
//        }else{
//            bonus = 0;
        }

        //Time bonus
        if(time_passed <= 12 hours){
            bonus += 50;
        }else if(time_passed <= 36 hours){
            bonus += 30;
        }else if(time_passed <= 4 days){
            bonus += 20;
        }else if(time_passed <= 7 days){
            bonus += 10;
        }else{
            bonus += 5;
        }

        tokenAmount = value*(100 + bonus)*((10 ** decimals)/100)/tokenPrice;
    }

}


contract UbermenschPreICOFinalizeAgent is FinalizeAgent {
    function isSane() public constant returns (bool) {
        return true;
    }
    /** Called once by crowdsale finalize() if the sale was success. */
    function finalizeCrowdsale() {
        //Do nothing on preICO
    }
}


/// @title UbermenschICO contract - Takes funds from users and issues tokens.
/// @author Dmitry Kochin - <k@ubermensch.com>
contract UbermenschPreICO is MintedTokenCappedCrowdsale, Constants{
    /*
     * External contracts
     */
    UbermenschToken public ubermenschToken;

    function UbermenschPreICO(address _token, address _multisig, uint _startDate, uint _endDate)
        MintedTokenCappedCrowdsale(_token, new UbermenschPreICOPricingStrategy(_startDate == 0 ? startDate : _startDate),
            _multisig, _startDate == 0 ? startDate : _startDate,
            _endDate == 0 ? endDate : _endDate,
            minimumFundingGoal, maximumSellableTokens) {

        setFinalizeAgent(new UbermenschPreICOFinalizeAgent());
    }

    /** We can start preICO in advance if the need arise
    */
    function startEarly() onlyOwner {
        if(getState() != State.Preparing && getState() != State.PreFunding)
        	throw;

        startsAt = now;
    }

    /**
     * Make an investment in BTC.
     * Owner must manually call this function with ether equivalent in value
     *
     * Crowdsale must be running for one to invest.
     * We must have not pressed the emergency brake.
     *
     *
     */
    function investBTC(address receiver, uint weiAmount) onlyOwner inState(State.Funding) stopInEmergency public {
        uint tokenAmount = pricingStrategy.calculatePrice(weiAmount, weiRaised, tokensSold, msg.sender, token.decimals());

        if(tokenAmount == 0)
        	throw; //Dust transaction

        if(investedAmountOf[receiver] == 0) {
            // A new investor
            investorCount++;
        }

        // Update investor
        //investedAmountOf[receiver] = investedAmountOf[receiver].plus(weiAmount); //BTC investors should be refunded manually
        tokenAmountOf[receiver] = tokenAmountOf[receiver].plus(tokenAmount);

        // Update totals
        weiRaised = weiRaised.plus(weiAmount);
        tokensSold = tokensSold.plus(tokenAmount);

        // Check that we did not bust the cap
        if(isBreakingCap(tokenAmount, weiAmount, weiRaised, tokensSold)) {
            throw;
        }

        assignTokens(receiver, tokenAmount);

        // Pocket the money
        //if(!multisigWallet.send(weiAmount)) throw; //We have already received BTC
        // Tell us invest was success
        Invested(receiver, weiAmount, tokenAmount, 0);
    }


    //Just rewrite this private function here from MintedTokenCappedCrowdsale
    function assignTokens(address receiver, uint tokenAmount) private {
        MintableToken mintableToken = MintableToken(token);
        mintableToken.mint(receiver, tokenAmount);
    }

    /// @dev Fallback function. Calls fund() function to create tokens.
    function () payable {
        throw; //Call buy() instead of sending money to contract address
    }
}
