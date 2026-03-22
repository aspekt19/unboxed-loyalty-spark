// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LoyaltyTokenEscrow
 * @notice Atomic P2P swap escrow for loyalty tokens on Base
 * @dev Creator deposits offerTokens into escrow. Accepter calls fill() which
 *      atomically transfers requestTokens from accepter to creator AND
 *      offerTokens from escrow to accepter. No trust required.
 *
 * Flow:
 *  1. Creator approves escrow for offerToken amount
 *  2. Creator calls createOffer() → tokens pulled into escrow
 *  3. Accepter approves escrow for requestToken amount
 *  4. Accepter calls fillOffer() → atomic swap
 *     OR Creator calls cancelOffer() → tokens returned
 */
contract LoyaltyTokenEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Offer {
        address creator;
        address offerToken;
        uint256 offerAmount;
        address requestToken;
        uint256 requestAmount;
        bool active;
    }

    uint256 public nextOfferId;
    mapping(uint256 => Offer) public offers;

    // Protocol fee: 0.5% (50 basis points), configurable by admin
    uint256 public feeBps = 50;
    address public feeRecipient;
    address public admin;

    event OfferCreated(
        uint256 indexed offerId,
        address indexed creator,
        address offerToken,
        uint256 offerAmount,
        address requestToken,
        uint256 requestAmount
    );

    event OfferFilled(
        uint256 indexed offerId,
        address indexed accepter,
        address indexed creator
    );

    event OfferCancelled(uint256 indexed offerId);
    event FeeUpdated(uint256 newFeeBps);
    event FeeRecipientUpdated(address newRecipient);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor(address _feeRecipient) {
        admin = msg.sender;
        feeRecipient = _feeRecipient;
    }

    /**
     * @notice Create a P2P exchange offer. Caller must have approved
     *         this contract for `offerAmount` of `offerToken`.
     */
    function createOffer(
        address offerToken,
        uint256 offerAmount,
        address requestToken,
        uint256 requestAmount
    ) external nonReentrant returns (uint256 offerId) {
        require(offerToken != requestToken, "Same token");
        require(offerAmount > 0 && requestAmount > 0, "Zero amount");

        offerId = nextOfferId++;
        offers[offerId] = Offer({
            creator: msg.sender,
            offerToken: offerToken,
            offerAmount: offerAmount,
            requestToken: requestToken,
            requestAmount: requestAmount,
            active: true
        });

        // Pull offer tokens into escrow
        IERC20(offerToken).safeTransferFrom(msg.sender, address(this), offerAmount);

        emit OfferCreated(offerId, msg.sender, offerToken, offerAmount, requestToken, requestAmount);
    }

    /**
     * @notice Fill an existing offer. Caller must have approved
     *         this contract for `requestAmount` of `requestToken`.
     *         Atomic swap: accepter gets offerTokens, creator gets requestTokens.
     */
    function fillOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        require(offer.active, "Offer not active");
        require(msg.sender != offer.creator, "Cannot fill own offer");

        offer.active = false;

        // Calculate protocol fee on the request side
        uint256 fee = (offer.requestAmount * feeBps) / 10000;
        uint256 creatorReceives = offer.requestAmount - fee;

        // Pull request tokens from accepter
        IERC20(offer.requestToken).safeTransferFrom(msg.sender, address(this), offer.requestAmount);

        // Send offer tokens to accepter (from escrow)
        IERC20(offer.offerToken).safeTransfer(msg.sender, offer.offerAmount);

        // Send request tokens to creator (minus fee)
        IERC20(offer.requestToken).safeTransfer(offer.creator, creatorReceives);

        // Send fee to protocol
        if (fee > 0 && feeRecipient != address(0)) {
            IERC20(offer.requestToken).safeTransfer(feeRecipient, fee);
        }

        emit OfferFilled(offerId, msg.sender, offer.creator);
    }

    /**
     * @notice Cancel an active offer and return escrowed tokens to creator.
     */
    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        require(offer.active, "Offer not active");
        require(msg.sender == offer.creator, "Not creator");

        offer.active = false;

        // Return escrowed tokens
        IERC20(offer.offerToken).safeTransfer(offer.creator, offer.offerAmount);

        emit OfferCancelled(offerId);
    }

    /**
     * @notice Get offer details.
     */
    function getOffer(uint256 offerId) external view returns (Offer memory) {
        return offers[offerId];
    }

    // ==================== Admin functions ====================

    function setFeeBps(uint256 _feeBps) external onlyAdmin {
        require(_feeBps <= 500, "Fee too high"); // Max 5%
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function setFeeRecipient(address _recipient) external onlyAdmin {
        feeRecipient = _recipient;
        emit FeeRecipientUpdated(_recipient);
    }

    function setAdmin(address _admin) external onlyAdmin {
        admin = _admin;
    }
}
