import {
  web3ReadOnly,
  wallet,
  applyDecimals,
  reverseDecimals,
  displayAddress,
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

window.uploadImage = async function(rootEvent) {
  if(!config) await connect();
  const input = document.createElement('input');
  const td = rootEvent.target.closest('td');
  input.setAttribute('type', 'file');
  input.onchange = (event) => {
    td.classList.toggle('loading', true);
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

        td.classList.toggle('loading', false);

        const uploadIndex = result.events.Uploaded.returnValues.index;
        const url = config.uploadPrefix + uploadIndex;
        td.innerHTML = `
          <img src="${url}" alt="Select Image" onclick="uploadImage(event)">
        `;
      }
    }
  };
  input.click();
}

async function erc20(address) {
  return new web3.eth.Contract(await (await fetch('/IERC20.abi')).json(), address);
}

window.addToken = async function() {
  const tbody = document.querySelector('#mints tbody');
  const index = tbody.childElementCount + 1;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>
      <button title="Remove Token" onclick="removeToken(event); return false">X</button>
      <span class="index">${index}</span>
    </td>
    <td>
      <button class="uploader" onclick="uploadImage(event); return false">
        Upload image...
      </button>
    </td>
    <td>
      <input type="text" placeholder="Address, ENS name, or empty">
    </td>
  `;
  tbody.appendChild(row);
}

window.removeToken = async function(event) {
  const tbody = document.querySelector('#mints tbody');
  const tr = event.target.closest('tr');
  if(tr.querySelector('img') && !confirm('Are you sure you want to remove this token?')) return;
  tbody.removeChild(tr);
}

window.mintCollection = async function(event) {
  if(!config) await connect();

  const name = document.querySelector('#name').value;
  const symbol = document.querySelector('#symbol').value;
  if(!name || !symbol) {
    alert('Name and symbol required!');
    return;
  }

  const mintData = Array.from(document.querySelectorAll('#mints tbody tr'))
    .map(row => {
      const image = row.querySelector('img');
      return [
        // tokenId
        row.querySelector('span.index').innerHTML,
        // recipient
        row.querySelector('input').value || accounts[0],
        // tokenURI
        image ? image.src.replace('http://web3q.io/', 'web3://') : null,
      ];
    }).filter(row => !!row[2]); // Filter out empty images
  if(!mintData.length) {
    alert('No images uploaded!');
    return;
  }
  const abi = await (await fetch('/OptimisticClaimableERC721.abi')).json();
  const bytecode = await (await fetch('/OptimisticClaimableERC721.bin')).text();
  const contract = new web3.eth.Contract(abi);
  const deployTx = contract.deploy({
    data: bytecode,
    arguments: [mintData, name, symbol,
      document.getElementById('public').checked
        ? config.contracts.PublicRegistry.address
        : ZERO_ACCOUNT
    ]
  });
  const deployedContract = await deployTx.send({ from: accounts[0] })

  // TODO redirect to collection details page
}

window.readRegistry = async function() {
  const registry = new web3.eth.Contract(
    await (await fetch('/PublicRegistry.abi')).json(),
    config.contracts.PublicRegistry.address);

  const count = await registry.methods.collectionCount().call();
  console.log(count);
}
