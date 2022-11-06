const Web3 = require('web3');
const fs = require('fs');

const config = require('../deploy-optimeme.json');
const chainParams = {
  gas: 3000000,
  gasPrice: 6000000000,
  explorer: config.explorer,
};
const BUILD_DIR = 'build/';

const web3 = new Web3(config.rpc);

const signer = web3.eth.accounts.privateKeyToAccount(config.private);
web3.eth.accounts.wallet.add(signer);

(async function() {
//   await deployContract('FileUpload');
  await deployContract('PublicRegistry');

})();

async function deployContract(name, args) {
  const bytecode = fs.readFileSync(`${BUILD_DIR}${name}.bin`, { encoding: 'utf8' });
  const abi = JSON.parse(fs.readFileSync(`${BUILD_DIR}${name}.abi`, { encoding: 'utf8' }));
  const contract = new web3.eth.Contract(abi);
  const deployTx = contract.deploy({
    data: bytecode,
    arguments: args
  });
  const gas = chainParams.gas;
  const balance = await web3.eth.getBalance(signer.address);
  console.log('gas: ', gas, 'fee: ', gas*chainParams.gasPrice, 'balance: ', balance, signer.address);
  const deployedContract = await deployTx
    .send({
      from: signer.address,
      gas,
      gasPrice: chainParams.gasPrice
    })
    .once("transactionHash", (txhash) => {
      console.log(`Mining deployment transaction ...`);
      console.log(chainParams.explorer + txhash);
    });
  // The contract is now deployed on chain!
  console.log(`Contract "${name}" deployed at ${deployedContract.options.address}`);
  return deployedContract;
}
