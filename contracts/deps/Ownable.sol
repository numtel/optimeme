// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract Ownable {
  address public owner;

  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  modifier onlyOwner() {
    require(owner == msg.sender, "Caller is not owner");
    _;
  }

  function _transferOwnership(address newOwner) internal {
    emit OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }
}
