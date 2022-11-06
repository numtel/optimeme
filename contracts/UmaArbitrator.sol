// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./deps/IERC20.sol";
import "./deps/SafeERC20.sol";

import "./deps/uma/StoreInterface.sol";
import "./deps/uma/FinderInterface.sol";
import "./deps/uma/OptimisticOracleV2Interface.sol";
import "./deps/uma/OptimisticRequester.sol";

import "./deps/uma/Constants.sol";

// Adaptation of deps/uma/OptimisticArbitrator.sol
//  except customized for delayed NFT transfer cases
contract UmaArbitrator is OptimisticRequester {
  using SafeERC20 for IERC20;

  FinderInterface public immutable finder;

  OptimisticOracleV2Interface public immutable oo;
  OptimisticRequester public immutable parent;

  IERC20 public immutable currency;

  bytes32 public priceIdentifier = "YES_OR_NO_QUERY";

  constructor(
    address _finderAddress,
    address _currency,
    address _parent
  ) {
    finder = FinderInterface(_finderAddress);
    currency = IERC20(_currency);
    oo = OptimisticOracleV2Interface(finder.getImplementationAddress(OracleInterfaces.OptimisticOracleV2));
    parent = OptimisticRequester(_parent);
  }

  modifier onlyParent() {
    require(address(parent) == msg.sender);
    _;
  }

  // Invoked at the start of a pending transfer
  function requestStatus(
    bytes memory ancillaryData,
    uint liveness
  ) external onlyParent {
    oo.requestPrice(priceIdentifier, block.timestamp, ancillaryData, currency, 0);
    if (liveness > 0) oo.setCustomLiveness(priceIdentifier, block.timestamp, ancillaryData, liveness);
    oo.setCallbacks(priceIdentifier, block.timestamp, ancillaryData, true, true, true);
  }

  // Invoked by the originator if transfer should be cancelled
  function assertPrice(
    address proposer,
    uint timestamp,
    bytes memory ancillaryData,
    int256 price
  ) external onlyParent {
    uint amount = _getStore().computeFinalFee(address(currency)).rawValue;
    if(amount > 0) {
      currency.safeTransferFrom(proposer, address(this), amount);
      currency.approve(address(oo), amount);
    }
    oo.proposePriceFor(
      proposer,
      address(this),
      priceIdentifier,
      timestamp,
      ancillaryData,
      price
    );
  }

  // Invoked by recipient if originator wrongly tries to cancel
  function dispute(
    address disputer,
    uint timestamp,
    bytes memory ancillaryData
  ) external onlyParent {
    uint amount = _getStore().computeFinalFee(address(currency)).rawValue;
    if(amount > 0) {
      currency.safeTransferFrom(disputer, address(this), amount);
      currency.approve(address(oo), amount);
    }
    oo.disputePriceFor(
      disputer,
      address(this),
      priceIdentifier,
      timestamp,
      ancillaryData
    );
  }

  function _getStore() internal view returns (StoreInterface) {
    return StoreInterface(finder.getImplementationAddress(OracleInterfaces.Store));
  }

  // Callbacks from Uma follow, passed through to the parent contract
  // Current holder has made counter-claim that NFT is actually theirs
  function priceProposed(
    bytes32 identifier,
    uint256 timestamp,
    bytes memory ancillaryData
  ) external {
    parent.priceProposed(identifier, timestamp, ancillaryData);
  }

  // Original claim maker asserts that the counter-claim is fraudulent
  function priceDisputed(
    bytes32 identifier,
    uint256 timestamp,
    bytes memory ancillaryData,
    uint256 refund
  ) external {
    parent.priceDisputed(identifier, timestamp, ancillaryData, refund);
  }

  // Transfer can be completed or reverted now
  function priceSettled(
    bytes32 identifier,
    uint256 timestamp,
    bytes memory ancillaryData,
    int256 price
  ) external {
    parent.priceSettled(identifier, timestamp, ancillaryData, price);
  }
}
