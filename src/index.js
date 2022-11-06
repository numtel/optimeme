import {
  web3ReadOnly,
  wallet,
  applyDecimals,
  reverseDecimals,
  displayAddress,
  ZERO_ACCOUNT,
  explorer,
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

  const collectionTbody = document.querySelector('#collections tbody');
  if(collectionTbody) {
    const registry = new web3.eth.Contract(
      await (await fetch('/PublicRegistry.abi')).json(),
      config.contracts.PublicRegistry.address);
    const result = await registry.methods.fetchCollections(0,100).call();
    let collectionRows = '';
    for(let collection of result) {
      collectionRows += `<tr>
        <td><a href="/details.html?collection=${collection.addr}">${collection.name}</a></td>
        <td><dl>
          <dt>Owner</dt>
          <dd><a href="${await explorer(collection.owner)}">${await displayAddress(collection.owner)}</a></dd>
          <dt>Count</dt>
          <dd>${collection.count}</dd>
        </dl></td>
      </tr>`;
    }
    collectionTbody.innerHTML = collectionRows;
  }

  const collection = document.querySelector('#collection');
  if(collection) {
    const url = new URL(window.location);
    const addr = url.searchParams.get('collection');
    const registry = new web3.eth.Contract(
      await (await fetch('/PublicRegistry.abi')).json(),
      config.contracts.PublicRegistry.address);
    const contract = new web3.eth.Contract(
      await (await fetch('/OptimisticClaimableERC721.abi')).json(),
      addr);
    const tokens = await registry.methods.fetchTokens(addr, 0, 1000).call();
    let html = `<h2>${await contract.methods.name().call()}</h2>`;
    if(await contract.methods.owner().call() === accounts[0]) {
      html += `
        <p>
          <a href="/change-owner.html?collection=${addr}">
            <button>Change Owner</button>
          </a>
          <a href="/mint.html?collection=${addr}">
            <button>Mint Tokens</button>
          </a>
        </p>
      `
    }
    for(let token of tokens) {
      html += `
        <a href="/nft.html?collection=${addr}&token=${token.tokenId}">
          <img src="${token.tokenURI.replace('web3://', 'http://web3q.io/')}">
        </a>
      `;
    }

    collection.innerHTML = html;
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
  let index;

  const url = new URL(window.location);
  const contractAddr = url.searchParams.get('collection');
  const contract = new web3.eth.Contract(
    await (await fetch('/OptimisticClaimableERC721.abi')).json(),
    contractAddr);
  if(document.getElementById('mints').classList.contains('additions')) {
    index = Number(await contract.methods.highestTokenId().call()) + 1 + tbody.childElementCount;
  } else {
    index = tbody.childElementCount + 1;
  }
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
  for(let token of mintData) {
    if(token[1].endsWith('.eth')) {
      try {
        const web3 = new Web3('https://eth.public-rpc.com/');
        token[1] = await web3.eth.ens.getAddress(token[1]);
      } catch(error) {
        alert('Invalid ENS name: ' + token[1]);
        return;
      }
    }
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

  window.location = '/details.html?collection=' + deployedContract.options.address;
}

window.mintMore = async function(event) {
  if(!config) await connect();


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
  for(let token of mintData) {
    if(token[1].endsWith('.eth')) {
      try {
        const web3 = new Web3('https://eth.public-rpc.com/');
        token[1] = await web3.eth.ens.getAddress(token[1]);
      } catch(error) {
        alert('Invalid ENS name: ' + token[1]);
        return;
      }
    }
  }

  const url = new URL(window.location);
  const contractAddr = url.searchParams.get('collection');
  const contract = new web3.eth.Contract(
    await (await fetch('/OptimisticClaimableERC721.abi')).json(),
    contractAddr);
  await contract.methods.batchMint(mintData).send({from:accounts[0]});

  window.location = '/details.html?collection=' + contractAddr;
}

window.changeOwner = async function(event) {
  if(!config) await connect();

  let addr = document.querySelector('#addr').value;
  if(addr.endsWith('.eth')) {
    try {
      const web3 = new Web3('https://eth.public-rpc.com/');
      addr = await web3.eth.ens.getAddress(addr);
    } catch(error) {
      alert('Invalid ENS name: ' + addr);
      return;
    }
  }
  const url = new URL(window.location);
  const contractAddr = url.searchParams.get('collection');
  const contract = new web3.eth.Contract(
    await (await fetch('/OptimisticClaimableERC721.abi')).json(),
    contractAddr);
  await contract.methods.transferOwnership(addr).send({from:accounts[0]});

  window.location = "/details.html?collection=" + contractAddr;

}

window.testRegistry = async function() {
  const registry = new web3.eth.Contract(
    await (await fetch('/PublicRegistry.abi')).json(),
    config.contracts.PublicRegistry.address);

  await registry.methods.register('0x56743A38eEFCF4A0B77544149C96b8dC7EB6a7D4')
    .send({from:accounts[0]});
}


window.readRegistry = async function() {
  const registry = new web3.eth.Contract(
    await (await fetch('/PublicRegistry.abi')).json(),
    config.contracts.PublicRegistry.address);

  const count = await registry.methods.collectionCount().call();
  console.log(count);
  const result = await registry.methods.fetchCollections(0,10).call();
  console.log(result);
}
