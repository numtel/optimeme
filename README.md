# Optimeme Factory 

## Installation

```
$ git clone https://github.com/numtel/optimeme.git
$ cd optimeme 
$ yarn
```

Download the `solc` compiler. This is used instead of `solc-js` because it is much faster. Binaries for other systems can be found in the [Ethereum foundation repository](https://github.com/ethereum/solc-bin/).
```
$ curl -o solc https://binaries.soliditylang.org/linux-amd64/solc-linux-amd64-v0.8.13+commit.abaa5c0e
$ chmod +x solc
```

## Start Frontend

No build steps, can serve `src` directory with any webserver.

```
# Use npm lite-server on port 3000
# yarn run dev
```

## Testing Contracts

```
# Build contracts before running tests
$ yarn run build-test
$ yarn run build-dev

$ yarn test
```
