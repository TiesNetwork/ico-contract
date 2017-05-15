pragma solidity ^0.4.8;

import "ico/CrowdsaleToken.sol";

/// @title Token contract - Implements Standard Token Interface with Ubermensch features.
/// @author Dmitry Kochin - <k@ubermensch.store>
//Token meta data string _name, string _symbol, uint _initialSupply, uint _decimals is passed to a base class
contract UbermenschToken is CrowdsaleToken("Ubermensch", "UMC", 0, 8) {

}
