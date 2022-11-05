// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./deps/Ownable.sol";
import "./deps/utils/AddressSet.sol";

interface ICollection {
  function name() external view returns(string memory);
  function symbol() external view returns(string memory);
}

contract PublicRegistry is Ownable {
  using AddressSet for AddressSet.Set;

  AddressSet.Set collections;

  struct Collection {
    address addr;
    string name;
    string symbol;
    address owner;
  }

  constructor() {
    _transferOwnership(msg.sender);
  }

  function transferOwnership(address newOwner) external onlyOwner {
    _transferOwnership(newOwner);
  }

  function register(address collection) external {
    collections.insert(collection);
  }

  function unregister(address collection) external {
    require(msg.sender == owner || msg.sender == Ownable(collection).owner());
    collections.remove(collection);
  }

  function isRegistered(address collection) external view returns(bool) {
    return collections.exists(collection);
  }

  function fetchCollections(
    uint startIndex,
    uint fetchCount
  ) external view returns (Collection[] memory) {
    uint itemCount = collections.keyList.length;
    if(itemCount == 0) {
      return new Collection[](0);
    }
    require(startIndex < itemCount);
    if(startIndex + fetchCount >= itemCount) {
      fetchCount = itemCount - startIndex;
    }
    Collection[] memory out = new Collection[](fetchCount);
    for(uint i; i < fetchCount; i++) {
      address addr = collections.keyList[startIndex + i];
      ICollection collection = ICollection(addr);
      out[i] = Collection(
        addr,
        collection.name(),
        collection.symbol(),
        Ownable(addr).owner()
      );
    }
    return out;
  }

  function collectionCount() external view returns(uint) {
    return collections.keyList.length;
  }
}
