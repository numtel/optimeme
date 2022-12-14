
export const configPromise = (async () => await (await fetch('/config.json')).json())();


export async function web3ReadOnly() {
  const config = await configPromise;
  return new Web3(config.rpc);
}

export async function wallet() {
  const config = await configPromise;
  const web3Modal = new Web3Modal.default({
    cacheProvider: true,
    providerOptions: {
      coinbasewallet: {
        package: CoinbaseWalletSDK,
        options: {
          appName: 'Optimeme Factory',
          rpc: config.rpc,
          chainId: Number(config.chain),
        }
      },
    }
  });
  let provider;
  try {
    provider = await web3Modal.connect();
  } catch(e) {
    console.log("Could not get a wallet connection", e);
    return;
  }
  const web3 = new Web3(provider);
  web3.eth.handleRevert = true;
  const chainId = '0x' + (await web3.eth.getChainId()).toString(16);
  if(chainId !== config.chain) {
    let tryAddChain = false;
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [ { chainId: config.chain } ]
      });
    } catch(error) {
      if(error.message.match(
          /wallet_addEthereumChain|Chain 0x[0-9a-f]+ hasn't been added/)) {
        tryAddChain = true;
      } else {
        alert(error.message);
        return;
      }
    }

    if(tryAddChain) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [ {
            chainId: config.chain,
            chainName: config.chainName,
            nativeCurrency: config.nativeCurrency,
            rpcUrls: [ config.rpc ],
            blockExplorerUrls: [ config.blockExplorer ]
          } ]
        });
      } catch(error) {
        alert(error.message);
        return;
      }
    }
  }
  const accounts = await new Promise((resolve, reject) => {
    web3.eth.getAccounts((error, accounts) => {
      if(error) reject(error);
      else resolve(accounts);
    });
  });
  return {web3, web3Modal, accounts, config};
}

export function decodeAscii(input) {
  let out = '';
  for(let i = 0; i<input.length; i+=2) {
    out += String.fromCharCode(parseInt(input.slice(i, i+2), 16));
  }
  return out;
}

// Turn 1230000 into 1.23
export function applyDecimals(input, decimals) {
  decimals = Number(decimals);
  input = String(input);
  if(input === '0') return input;
  while(input.length <= decimals) {
    input = '0' + input;
  }
  const sep = decimalSeparator();
  input = input.slice(0, -decimals) + sep + input.slice(-decimals);
  while(input[input.length - 1] === '0') {
    input = input.slice(0, -1);
  }
  if(input[input.length - 1] === sep) {
    input = input.slice(0, -1);
  }
  return input;
}

// Turn 1.23 into 1230000
export function reverseDecimals(input, decimals) {
  decimals = Number(decimals);
  input = String(input);
  if(input === '0') return input;
  const sep = decimalSeparator();
  const sepIndex = input.indexOf(sep);
  if(sepIndex === -1) {
    // Add all digits to end
    input += zeroStr(decimals);
  } else {
    const trailingZeros = decimals - (input.length - sepIndex - 1);
    if(trailingZeros < 0) {
      // Too many decimal places input
      input = input.slice(0, sepIndex) + input.slice(sepIndex + 1, trailingZeros);
    } else {
      // Right pad
      input = input.slice(0, sepIndex) + input.slice(sepIndex + 1) + zeroStr(trailingZeros);
    }
  }
  // Remove leading zeros
  while(input.slice(0,1) === '0') {
    input = input.slice(1);
  }
  return input;
}

function zeroStr(length) {
  let str = '';
  while(str.length < length) {
    str += '0';
  }
  return str;
}

// From https://stackoverflow.com/q/2085275
function decimalSeparator() {
  const n = 1.1;
  return n.toLocaleString().substring(1, 2);
}

export function ellipseAddress(address) {
  return address.slice(0, 6) + '...' + address.slice(-4);
}

export function remaining(seconds) {
  const units = [
    { value: 1, unit: 'second' },
    { value: 60, unit: 'minute' },
    { value: 60 * 60, unit: 'hour' },
    { value: 60 * 60 * 24, unit: 'day' },
  ];
  let remaining = seconds;
  let out = [];
  for(let i = units.length - 1; i >= 0;  i--) {
    if(remaining >= units[i].value) {
      const count = Math.floor(remaining / units[i].value);
      out.push(count.toString(10) + ' ' + units[i].unit + (count !== 1 ? 's' : ''));
      remaining = remaining - (count * units[i].value);
    }
  }
  return out.join(', ');
}

export const ZERO_ACCOUNT = '0x0000000000000000000000000000000000000000';

export function delay(ms) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms);
  });
}

export async function explorer(address) {
  const config = await configPromise;
  return config.blockExplorer + '/address/' + address;
}

export function isAddress(address) {
  return typeof address === 'string' && address.match(/^0x[a-f0-9]{40}$/i);
}

export function isBytes32(value) {
  return typeof value === 'string' && value.match(/^0x[a-f0-9]{64}$/i);
}

export function isFunSig(value) {
  return typeof value === 'string' && value.match(/^0x[a-f0-9]{8}$/i);
}

export async function displayAddress(address) {
  const name = await ensReverse(address);
  if(name) return name;
  return ellipseAddress(address);
}

// TODO cache responses
export async function ensReverse(address) {
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

