// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./deps/ERC721/extensions/ERC721URIStorage.sol";
import "./deps/Ownable.sol";
import "./deps/uma/OptimisticRequester.sol";

import "./UmaArbitrator.sol";

contract DelayedERC721 is ERC721URIStorage, Ownable, UmaArbitrator, OptimisticRequester {
  uint constant public delayDuration = 2 days;

  struct MintData {
    uint tokenId;
    address recipient;
    string tokenURI;
  }

  struct TransferData {
    uint tokenId;
    address originator;
    address recipient;
    uint beginTime;
  }

  TransferData[] public transfers;
  mapping(uint => uint) public transfersByTokenId;

  constructor(
    MintData[] memory initialMint,
    string memory name_,
    string memory symbol_,
    address _finderAddress,
    address _currency
  ) ERC721(name_, symbol_) UmaArbitrator(_finderAddress, _currency) {
    _transferOwnership(msg.sender);
    _batchMint(initialMint);
  }

  function _batchMint(MintData[] memory data) internal {
    for(uint i=0; i<data.length; i++) {
      _safeMint(data[i].recipient, data[i].tokenId);
      _setTokenURI(data[i].tokenId, data[i].tokenURI);
    }
  }

  function batchMint(MintData[] memory data) external onlyOwner {
    _batchMint(data);
  }

  function transferOwnership(address newOwner) external onlyOwner {
    _transferOwnership(newOwner);
  }

  // TODO aaaaaaaaaaa!!!!!
  function arbitratorTransfer(uint tokenId, address recipient, bytes memory data) internal {
    _safeTransfer(_ownerOf(tokenId), recipient, tokenId, data);
  }

  function transferFrom(
      address from,
      address to,
      uint256 tokenId
  ) public virtual override {
    require(transfersByTokenId[tokenId] == 0);
    transfers.push(TransferData(tokenId, from, to, block.timestamp));
    transfersByTokenId[tokenId] = transfers.length;

    // TODO add more descriptive data
    bytes memory ancillaryData = abi.encode(transfers.length);
    _requestStatus(ancillaryData, delayDuration);
  }

  function safeTransferFrom(
      address from,
      address to,
      uint256 tokenId,
      bytes memory data
  ) public virtual override {
  }


  // Callbacks from Uma follow
  function priceProposed(
    bytes32 identifier,
    uint256 timestamp,
    bytes memory ancillaryData
  ) external {
  }

  function priceDisputed(
    bytes32 identifier,
    uint256 timestamp,
    bytes memory ancillaryData,
    uint256 refund
  ) external {
  }

  function priceSettled(
    bytes32 identifier,
    uint256 timestamp,
    bytes memory ancillaryData,
    int256 price
  ) external {
  }

}
