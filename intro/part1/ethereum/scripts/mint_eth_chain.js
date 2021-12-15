// run this script with truffle exec

const jsonfile = require("jsonfile");
const NFT = artifacts.require("NFT");
const NFTImplementationFullABI = jsonfile.readFileSync(
  "../build/contracts/NFTImplementation.json"
).abi;

module.exports = async function(callback) {
  try {
    const accounts = await web3.eth.getAccounts();
    const initialized = new web3.eth.Contract(
      NFTImplementationFullABI,
      NFT.address
    );

    // Mint the Eth run (tokenIDs 1-10)
    for (let i = 1; i <= 10; i++) {
      await initialized.methods
        .mint(accounts[0], i, "http://localhost:3000/nft.json")
        .send({
          value: 0,
          from: accounts[0],
          gasLimit: 2000000,
        });
    }

    callback();
  } catch (e) {
    callback(e);
  }
};
