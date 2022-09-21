// https://134.209.144.170

const Web3 = require("web3");

const provider = new Web3.providers.HttpProvider();

const web3 = new Web3(provider);


web3.eth.getBalance(a.address).then(balance => {
    console.log(balance)
})