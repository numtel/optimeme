// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IArbitrable {
  event ArbitratorChanged(address indexed previousArbitrator, address indexed newArbitrator);
  function arbitrator() external view returns (address);
  function changeArbitrator(address newArbitrator) external;
}
