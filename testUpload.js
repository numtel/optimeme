const Web3 = require('web3');
const fs = require('fs');

const config = require('../deploy-optimeme.json');
const chainParams = {
  gas: 50000000,
  gasPrice: 6000000000,
  explorer: 'https://explorer.galileo.web3q.io/tx/',
};
const BUILD_DIR = 'build/';

const web3 = new Web3(config.rpc);

const signer = web3.eth.accounts.privateKeyToAccount(config.private);
web3.eth.accounts.wallet.add(signer);

(async function() {
  const contract = await loadContract('FileUpload', '0x38CC5b3A68c243337A73c1076BaB066BaE4A64D5');
  const image = fs.readFileSync(`test3.jpg`);
  console.log(image);
  const upload = await contract.methods.upload(image).send({
    from: signer.address,
    gas: chainParams.gas,
    gasPrice: chainParams.gasPrice,
  });
  console.log(upload);
  console.log(upload.events.Uploaded);

//   const load = await contract.methods.load(2).call();
//   console.log(load);
})();

async function loadContract(name, address) {
  const abi = JSON.parse(fs.readFileSync(`${BUILD_DIR}${name}.abi`, { encoding: 'utf8' }));
  return new web3.eth.Contract(abi, address);
}
