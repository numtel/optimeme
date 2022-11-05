// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./ERC165.sol";
import "./IArbitrable.sol";

error Unauthorized();

abstract contract Arbitrable is ERC165, IArbitrable {
  address public arbitrator;

  constructor() {
    arbitrator = msg.sender;
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
    return interfaceId == type(IArbitrable).interfaceId || super.supportsInterface(interfaceId);
  }

  modifier onlyArbitrator() {
    if(msg.sender != arbitrator)
      revert Unauthorized();
    _;
  }

  modifier onlyArbitratorIfAvailable() {
    if(msg.sender != arbitrator && arbitrator != address(0))
      revert Unauthorized();
    _;
  }

  function changeArbitrator(address newArbitrator) external onlyArbitrator {
    emit ArbitratorChanged(arbitrator, newArbitrator);
    arbitrator = newArbitrator;
  }
}
