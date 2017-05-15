
var UbermenschToken = artifacts.require("UbermenschToken.sol");
var UbermenschPreICO = artifacts.require("UbermenschPreICO.sol");
var SafeMathLib = artifacts.require("SafeMathLib.sol");

module.exports = async function(deployer, network) {

    var founder;
    if (network == "live") {
        founder = "0xc890b1f532e674977dfdb791cafaee898dfa9671";
    } else {
        founder = "0xaec3ae5d2be00bfc91597d7a1b2c43818d84396a";
    }    

	deployer.deploy(SafeMathLib);
    deployer.link(SafeMathLib, [UbermenschToken,UbermenschPreICO]);

    deployer.deploy(UbermenschToken, founder).then(function(){
    	return deployer.deploy(UbermenschPreICO, UbermenschToken.address, founder, 0, 0);
    }).then(function() {
        return UbermenschToken.deployed();
    }).then(function(instance){
        //Allow ICO contract to mint tokens
		instance.setMintAgent(UbermenschPreICO.address, true);
        //Allow founder to release token transfer
		instance.setReleaseAgent(founder);
    });

};
