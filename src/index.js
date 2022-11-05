import {
  web3ReadOnly,
  wallet,
  applyDecimals,
  reverseDecimals,
  ellipseAddress,
  ZERO_ACCOUNT,
} from './wallet.js';

let web3, web3Modal, accounts, config;

window.addEventListener('load', async function() {
  const walletEl = document.getElementById('wallet-status');
  if(localStorage.getItem("WEB3_CONNECT_CACHED_PROVIDER")) {
    await connect();
  } else {
    web3 = await web3ReadOnly();
    accounts = [ZERO_ACCOUNT];
    walletEl.innerHTML = `<button onclick="connect()" title="Connect Wallet">Connect Wallet</button>`;
  }

});

window.connect = async function() {
  const result = await wallet();
  web3 = result.web3;
  web3Modal = result.web3Modal;
  accounts = result.accounts;
  config = result.config;
  const walletEl = document.getElementById('wallet-status');
  walletEl.innerHTML = `
    <a href="/account/${accounts[0]}" title="View Account Profile"><button>Connected as ${await displayAddress(accounts[0])}</button></a>
    <button onclick="disconnect()">Disconnect Wallet</button>
  `;
}

window.disconnect = async function() {
  await web3Modal.clearCachedProvider();
  window.location.reload();
}

window.uploadImage = async function() {
  if(!config) await connect();
  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.onchange = (event) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(event.target.files[0]);
    reader.onloadend = async (evt) => {
      if(evt.target.readyState === FileReader.DONE) {
        const data = new Uint8Array(evt.target.result);
        const uploader = new web3.eth.Contract(
          await (await fetch('/FileUpload.abi')).json(),
          config.contracts.FileUpload.address);
        const result = await uploader.methods.upload(data).send({
          from: accounts[0]
        });
        console.log(data, result, web3);
      }
    }
  };
  input.click();
}

async function erc20(address) {
  return new web3.eth.Contract(await (await fetch('/IERC20.abi')).json(), address);
}

async function displayAddress(address) {
  const name = await ensReverse(address);
  if(name) return name;
  return ellipseAddress(address);
}

async function ensReverse(address) {
  const web3 = new Web3('https://eth.public-rpc.com/');
  const namehash = await web3.eth.call({
    to: '0x084b1c3c81545d370f3634392de611caabff8148', // ENS: Reverse Registrar
    data: web3.eth.abi.encodeFunctionCall({
      name: 'node', type: 'function',
      inputs: [{type: 'address', name: 'addr'}]
    }, [address])
  });
  return web3.eth.abi.decodeParameter('string', await web3.eth.call({
    to: '0xa2c122be93b0074270ebee7f6b7292c7deb45047', // ENS: Default Reverse Resolver
    data: web3.eth.abi.encodeFunctionCall({
      name: 'name', type: 'function',
      inputs: [{type: 'bytes32', name: 'hash'}]
    }, [namehash])
  }));
}

