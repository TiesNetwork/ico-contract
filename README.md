# Ubermensch Contracts

## Dependencies
We use Truffle in order to compile and test the contracts.

It can be installed:
`npm install -g truffle`

For more information visit https://truffle.readthedocs.io/en/latest/

Place https://github.com/UbermenschProject/ico/tree/master/contracts to installed_contracts/ico/
Place https://github.com/UbermenschProject/ico/tree/master/contractsPlace https://github.com/OpenZeppelin/zeppelin-solidity/tree/ffce7e3b08afad8d08a5fdbfbbca098f4d6cdf4e/contracts to installed_contracts/zeppelin/contracts/

Also running node with active json-rpc is required. For testing puproses we suggest using https://github.com/ethereumjs/testrpc
## Usage
`./run_testrpc.bat` - run testrpc node with required params

`truffle compile` - compile all contracts

`truffle test` - run tests
