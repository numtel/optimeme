// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./deps/ERC721/extensions/ERC721URIStorage.sol";
import "./deps/Ownable.sol";
import "./deps/uma/OptimisticRequester.sol";
import "./deps/utils/Strings.sol";
import "./deps/utils/AddressSet.sol";

interface IArbitrator {
  function priceIdentifier() external view returns(bytes32);

  function requestStatus(
    bytes memory ancillaryData,
    uint liveness
  ) external;

  function assertPrice(
    address proposer,
    uint timestamp,
    bytes memory ancillaryData,
    int256 price
  ) external;

  function dispute(
    address disputer,
    uint timestamp,
    bytes memory ancillaryData
  ) external;
}

interface IRegistry {
  function register(address collection) external;
  function registerToken(uint tokenId) external;
}

contract OptimisticClaimableERC721 is ERC721URIStorage, Ownable, OptimisticRequester {
  using AddressSet for AddressSet.Set;

  uint constant public claimDuration = 4 days;
  address public arbitrator;
  address public registry;
  uint public highestTokenId;

  struct MintData {
    uint tokenId;
    address recipient;
    string tokenURI;
  }

  enum ClaimStatus { PENDING, COUNTERED, APPEALED, APPROVED, DECLINED }
  struct ClaimData {
    ClaimStatus status;
    uint claimNumber;
    uint tokenId;
    address recipient;
    uint beginTime;
    bytes ancillaryData;
  }

  ClaimData[] public claims;
  mapping(address => uint) public claimsById;
  mapping(bytes => address) public claimsByAncillaryData;
  mapping(uint => AddressSet.Set) claimsByTokenId;
  event TokenClaimed(uint tokenId, address indexed recipient, uint claimIndex, address claimId);
  event ClaimCountered(uint tokenId, uint claimIndex, address claimId);
  event ClaimAppealed(uint tokenId, uint claimIndex, address claimId, uint refund);
  event ClaimApproved(uint tokenId, uint claimIndex, address claimId);
  event ClaimDeclined(uint tokenId, uint claimIndex, address claimId);
  event NewArbitrator(address indexed oldArbitrator, address indexed newArbitrator);

  constructor(
    MintData[] memory initialMint,
    string memory name_,
    string memory symbol_,
    address registry_
  ) ERC721(name_, symbol_) {
    _transferOwnership(msg.sender);

    if(registry_ != address(0)) {
      registry = registry_;
      IRegistry(registry).register(address(this));
    }

    _batchMint(initialMint);
  }

  function _batchMint(MintData[] memory data) internal {
    for(uint i=0; i<data.length; i++) {
      _safeMint(data[i].recipient, data[i].tokenId);
      _setTokenURI(data[i].tokenId, data[i].tokenURI);
      if(registry != address(0)) {
        IRegistry(registry).registerToken(data[i].tokenId);
      }
      if(data[i].tokenId > highestTokenId) {
        highestTokenId = data[i].tokenId;
      }
    }
  }

  function batchMint(MintData[] memory data) external onlyOwner {
    _batchMint(data);
  }

  function transferOwnership(address newOwner) external onlyOwner {
    _transferOwnership(newOwner);
  }

  function setArbitrator(address newArbitrator) external onlyOwner {
    emit NewArbitrator(arbitrator, newArbitrator);
    arbitrator = newArbitrator;
  }

  // Fetch a paginated set of claims to ownership of a specific token
  function tokenClaims(
    uint256 tokenId,
    uint startIndex,
    uint fetchCount
  ) external view returns (ClaimData[] memory) {
    uint itemCount = claimsByTokenId[tokenId].keyList.length;
    if(itemCount == 0) {
      return new ClaimData[](0);
    }
    require(startIndex < itemCount);
    if(startIndex + fetchCount >= itemCount) {
      fetchCount = itemCount - startIndex;
    }
    ClaimData[] memory out = new ClaimData[](fetchCount);
    for(uint i; i < fetchCount; i++) {
      address claimId = claimsByTokenId[tokenId].keyList[startIndex + i];
      out[i] = claims[claimsById[claimId]];
    }
    return out;
  }

  function tokenClaimCount(uint256 tokenId) external view returns(uint) {
    return claimsByTokenId[tokenId].keyList.length;
  }

  // Make a claim to the rightful owner of a token
  function claimToken(
      address to,
      uint256 tokenId,
      string memory inputStatement
  ) public {
    require(arbitrator != address(0));

    bytes memory ancillaryData = abi.encodePacked(
      Strings.toHexString(to),
      " is the rightful owner of token with ID #",
      Strings.toString(tokenId),
      "? Answer: 0 yes (default) or 1 for no. (Claim #",
      Strings.toString(claims.length),
      ") Their statement: ",
      inputStatement
    );

    ClaimData memory claim = ClaimData(
      ClaimStatus.PENDING,
      claims.length, tokenId, to, block.timestamp, ancillaryData);
    address claimId = claimHash(claim);

    emit TokenClaimed(tokenId, to, claims.length, claimId);
    claimsById[claimId] = claims.length;
    claimsByAncillaryData[ancillaryData] = claimId;
    // The AddressSet will ensure uniqueness
    claimsByTokenId[tokenId].insert(claimId);
    claims.push(claim);

    IArbitrator(arbitrator).requestStatus(ancillaryData, claimDuration);
  }

  // TODO add bytes storage for the counter claim to state their case
  function claimCounter(uint claimIndex) external {
    require(arbitrator != address(0));
    ClaimData storage claim = claims[claimIndex];
    require(claim.status == ClaimStatus.PENDING);

    IArbitrator(arbitrator).assertPrice(msg.sender, claim.beginTime, claim.ancillaryData, 1);
  }

  // TODO add bytes data storage for the appeal case to be made
  function claimAppeal(uint claimIndex) external {
    require(arbitrator != address(0));
    ClaimData storage claim = claims[claimIndex];
    require(claim.status == ClaimStatus.COUNTERED);

    IArbitrator(arbitrator).dispute(msg.sender, claim.beginTime, claim.ancillaryData);
  }

  // Hash such that an account can only claim a token once
  function claimHash(ClaimData memory input) internal pure returns(address) {
    return address(uint160(uint256(keccak256(abi.encode(
      input.tokenId,
      input.recipient
    )))));
  }

  // Callbacks from Uma follow
  // Current holder has made counter-claim that NFT is actually theirs
  function priceProposed(
    bytes32 identifier,
    uint256 timestamp,
    bytes memory ancillaryData
  ) external {
    address claimId = claimsByAncillaryData[ancillaryData];
    ClaimData storage claim = claims[claimsById[claimId]];

    require(identifier == IArbitrator(arbitrator).priceIdentifier());
    require(timestamp == claim.beginTime);
    claim.status = ClaimStatus.COUNTERED;
    emit ClaimCountered(claim.tokenId, claim.claimNumber, claimHash(claim));
  }

  // Original claim maker asserts that the counter-claim is fraudulent
  function priceDisputed(
    bytes32 identifier,
    uint256 timestamp,
    bytes memory ancillaryData,
    uint256 refund
  ) external {
    address claimId = claimsByAncillaryData[ancillaryData];
    ClaimData storage claim = claims[claimsById[claimId]];

    require(identifier == IArbitrator(arbitrator).priceIdentifier());
    require(timestamp == claim.beginTime);
    claim.status = ClaimStatus.APPEALED;
    emit ClaimAppealed(claim.tokenId, claim.claimNumber, claimId, refund);
  }

  // Transfer can be completed or reverted now
  function priceSettled(
    bytes32 identifier,
    uint256 timestamp,
    bytes memory ancillaryData,
    int256 price
  ) external {
    address claimId = claimsByAncillaryData[ancillaryData];
    ClaimData storage claim = claims[claimsById[claimId]];

    require(identifier == IArbitrator(arbitrator).priceIdentifier());
    require(timestamp == claim.beginTime);
    if(price == 0) {
      claim.status = ClaimStatus.APPROVED;
      _safeTransfer(_ownerOf(claim.tokenId), claim.recipient, claim.tokenId, abi.encodePacked(claimId));
      emit ClaimApproved(claim.tokenId, claim.claimNumber, claimId);
    } else {
      claim.status = ClaimStatus.DECLINED;
      emit ClaimDeclined(claim.tokenId, claim.claimNumber, claimId);
    }

    // This user can now make a new claim to this token if necessary
    claimsByTokenId[claim.tokenId].remove(claimId);
  }

}
