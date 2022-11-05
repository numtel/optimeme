// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./deps/IERC20.sol";
import "./deps/SafeERC20.sol";

import "./deps/uma/StoreInterface.sol";
import "./deps/uma/FinderInterface.sol";
import "./deps/uma/OptimisticOracleV2Interface.sol";

import "./deps/uma/Constants.sol";

// Adaptation of deps/uma/OptimisticArbitrator.sol
//  except customized for delayed NFT transfer cases
contract UmaArbitrator {
  using SafeERC20 for IERC20;

  FinderInterface public immutable finder;

  OptimisticOracleV2Interface public immutable oo;

  IERC20 public immutable currency;

  bytes32 public priceIdentifier = "YES_OR_NO_QUERY";

  constructor(
    address _finderAddress,
    address _currency
  ) {
    finder = FinderInterface(_finderAddress);
    currency = IERC20(_currency);
    oo = OptimisticOracleV2Interface(finder.getImplementationAddress(OracleInterfaces.OptimisticOracleV2));
  }

  // Invoked at the start of a pending transfer
  function _requestStatus(
    bytes memory ancillaryData,
    uint liveness
  ) internal {
    oo.requestPrice(priceIdentifier, block.timestamp, ancillaryData, currency, 0);
    if (liveness > 0) oo.setCustomLiveness(priceIdentifier, block.timestamp, ancillaryData, liveness);
  }

  // Invoked by the originator if transfer should be cancelled
  function _assert(
    address proposer,
    uint timestamp,
    bytes memory ancillaryData
  ) internal {
    uint amount = _getStore().computeFinalFee(address(currency)).rawValue;
    currency.safeTransferFrom(proposer, address(this), amount);
    currency.approve(address(oo), amount);
    oo.proposePriceFor(
      proposer,
      address(this),
      priceIdentifier,
      timestamp,
      ancillaryData,
      1
    );
  }

  // Invoked by recipient if originator wrongly tries to cancel
  function _dispute(
    address disputer,
    uint timestamp,
    bytes memory ancillaryData
  ) internal {
    
  }

  function _getStore() internal view returns (StoreInterface) {
    return StoreInterface(finder.getImplementationAddress(OracleInterfaces.Store));
  }
}
