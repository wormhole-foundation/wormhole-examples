module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    development2: {
      host: "127.0.0.1",
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
};
