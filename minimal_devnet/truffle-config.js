require("dotenv").config({ path: ".env" });

module.exports = {
  networks: {
    development: {
      host: "eth1",
      port: 8545,
      network_id: "*",
    },
    development2: {
      host: "eth2",
      port: 8546,
      network_id: "*",
    },
  },

  compilers: {
    solc: {
      version: "0.8.4",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },

  plugins: ["@chainsafe/truffle-plugin-abigen", "truffle-plugin-verify"],

  api_keys: {
    etherscan: process.env.ETHERSCAN_KEY,
  },
};
