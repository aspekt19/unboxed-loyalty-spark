// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RoundUpVault
 * @notice Main contract for Round-Up investment system on Base Mainnet
 * @dev MVP version for Base mainnet with ETH round-up and investment strategies
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Deploy AaveConservativeStrategy and/or LendingPlusStrategy first
 * 2. Deploy this contract with:
 *    - _ethPriceFeed: 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70
 *    - _strategy: Address of deployed strategy (Aave or Compound)
 * 3. Call setVault(vaultAddress) on strategy contracts
 */

// ============================
// BASE MAINNET ADDRESSES
// ============================
address constant NATIVE_TOKEN = address(0); // ETH

// ============================
// INTERFACES
// ============================

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

interface IInvestmentStrategy {
    function deposit(address _user) external payable returns (uint256 amountInvested);
    function withdraw(address _user, uint256 _amount) external returns (uint256 ethReturned);
    function getUserValue(address _user) external view returns (uint256 currentValue);
}

// ============================
// MAIN CONTRACT
// ============================

contract RoundUpVault {
    // ============================
    // CONSTANTS
    // ============================
    uint256 public constant USD_DECIMALS = 8;
    uint256 public constant MIN_INVEST_AMOUNT = 0.001 ether; // ~$3-4, minimum for investing
    
    // ============================
    // STATE VARIABLES
    // ============================
    address public owner;
    IInvestmentStrategy public strategy;
    
    // Supported tokens with their price feeds
    struct TokenInfo {
        address priceFeed;
        bool isSupported;
        uint8 decimals;
    }
    
    mapping(address => TokenInfo) public supportedTokens;
    
    enum Strategy {
        AAVE_CONSERVATIVE,
        COMPOUND_LENDING_PLUS
    }
    
    struct UserSettings {
        bool autoInvest;
        uint256 roundUpMultiplier;
    }
    
    struct UserBalance {
        uint256 pendingRoundUp;
        uint256 invested;
    }
    
    struct TokenBalance {
        mapping(address => uint256) pendingRoundUp;
        mapping(address => uint256) invested;
    }
    
    mapping(address => UserSettings) public userSettings;
    mapping(address => UserBalance) public userBalances;
    mapping(address => TokenBalance) private userTokenBalances;
    
    // ============================
    // EVENTS
    // ============================
    event SettingsUpdated(address indexed user, bool autoInvest, uint256 roundUpMultiplier);
    event RoundUpCollected(address indexed user, address indexed token, uint256 roundUpAmount, uint256 primaryTxValue);
    event Invested(address indexed user, uint256 amount, uint256 investedValue);
    event Withdrawn(address indexed user, uint256 amount, uint256 ethReturned);
    event StrategyUpdated(address indexed newStrategy);
    event TokenAdded(address indexed token, address indexed priceFeed);
    event TokenRemoved(address indexed token);
    event DirectDeposit(address indexed user, uint256 amount);
    
    // ============================
    // MODIFIERS
    // ============================
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    // ============================
    // CONSTRUCTOR
    // ============================
    constructor(address _ethPriceFeed, address _strategy) {
        owner = msg.sender;
        strategy = IInvestmentStrategy(_strategy);
        
        // Add ETH as default supported token
        supportedTokens[NATIVE_TOKEN] = TokenInfo({
            priceFeed: _ethPriceFeed,
            isSupported: true,
            decimals: 18
        });
    }
    
    // ============================
    // TOKEN MANAGEMENT
    // ============================
    
    /**
     * @notice Add support for a new token
     * @param _token Token address (use address(0) for native ETH)
     * @param _priceFeed Chainlink price feed address for the token
     */
    function addSupportedToken(address _token, address _priceFeed) external onlyOwner {
        require(_priceFeed != address(0), "Invalid price feed");
        
        uint8 decimals = 18;
        if (_token != NATIVE_TOKEN) {
            decimals = IERC20(_token).decimals();
        }
        
        supportedTokens[_token] = TokenInfo({
            priceFeed: _priceFeed,
            isSupported: true,
            decimals: decimals
        });
        
        emit TokenAdded(_token, _priceFeed);
    }
    
    /**
     * @notice Remove support for a token
     * @param _token Token address to remove
     */
    function removeSupportedToken(address _token) external onlyOwner {
        require(_token != NATIVE_TOKEN, "Cannot remove native token");
        supportedTokens[_token].isSupported = false;
        emit TokenRemoved(_token);
    }
    
    // ============================
    // USER SETTINGS
    // ============================
    
    /**
     * @notice Initialize settings for new user
     * @dev Sets default values: autoInvest=true, multiplier=1
     */
    function initializeSettings() external {
        require(userSettings[msg.sender].roundUpMultiplier == 0, "Already initialized");
        
        userSettings[msg.sender] = UserSettings({
            autoInvest: true,
            roundUpMultiplier: 1
        });
        
        emit SettingsUpdated(msg.sender, true, 1);
    }
    
    /**
     * @notice Update user settings
     * @param _autoInvest Enable automatic investment
     * @param _roundUpMultiplier Multiplier for round-up (1-10)
     */
    function updateSettings(
        bool _autoInvest,
        uint256 _roundUpMultiplier
    ) external {
        require(_roundUpMultiplier > 0 && _roundUpMultiplier <= 10, "Invalid multiplier");
        
        UserSettings storage settings = userSettings[msg.sender];
        settings.autoInvest = _autoInvest;
        settings.roundUpMultiplier = _roundUpMultiplier;
        
        emit SettingsUpdated(msg.sender, _autoInvest, _roundUpMultiplier);
    }
    
    // ============================
    // PRICE FEEDS
    // ============================
    
    /**
     * @notice Get token price from Chainlink
     * @param _token Token address (use address(0) for ETH)
     * @return price Token price in USD (8 decimals)
     */
    function getTokenPrice(address _token) public view returns (uint256) {
        require(supportedTokens[_token].isSupported, "Token not supported");
        AggregatorV3Interface priceFeed = AggregatorV3Interface(supportedTokens[_token].priceFeed);
        (, int256 price, , ,) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        return uint256(price);
    }
    
    /**
     * @notice Calculate round-up amount for any token
     * @param _token Token address (use address(0) for ETH)
     * @param _tokenAmount Amount of tokens
     * @return roundUpAmount Amount of tokens needed to round up to next dollar
     */
    function calculateRoundUp(address _token, uint256 _tokenAmount) public view returns (uint256) {
        require(supportedTokens[_token].isSupported, "Token not supported");
        
        uint256 tokenPrice = getTokenPrice(_token);
        uint8 tokenDecimals = supportedTokens[_token].decimals;
        
        uint256 purchaseValueUSD = (_tokenAmount * tokenPrice) / (10 ** tokenDecimals);
        uint256 nextDollar = ((purchaseValueUSD / (10 ** USD_DECIMALS)) + 1) * (10 ** USD_DECIMALS);
        uint256 roundUpUSD = nextDollar - purchaseValueUSD;
        uint256 roundUpTokens = (roundUpUSD * (10 ** tokenDecimals)) / tokenPrice;
        
        return roundUpTokens;
    }
    
    // ============================
    // DEPOSIT FUNCTIONS
    // ============================
    
    /**
     * @notice Direct deposit ETH for investment (bypassing round-up)
     * @dev Allows users to invest directly without round-up transactions
     *      Respects autoInvest setting: invests immediately or adds to pending
     */
    function directDeposit() external payable {
        require(msg.value > 0, "Amount must be > 0");
        require(msg.value >= MIN_INVEST_AMOUNT, "Amount below minimum");
        
        UserSettings storage settings = userSettings[msg.sender];
        
        emit DirectDeposit(msg.sender, msg.value);
        
        if (settings.autoInvest) {
            // Invest immediately
            uint256 investedValue = strategy.deposit{value: msg.value}(msg.sender);
            userBalances[msg.sender].invested += investedValue;
            
            emit Invested(msg.sender, msg.value, investedValue);
        } else {
            // Add to pending balance
            userBalances[msg.sender].pendingRoundUp += msg.value;
            userTokenBalances[msg.sender].pendingRoundUp[NATIVE_TOKEN] += msg.value;
            
            emit RoundUpCollected(msg.sender, NATIVE_TOKEN, msg.value, 0);
        }
    }
    
    // ============================
    // ROUND-UP FUNCTIONS
    // ============================
    
    /**
     * @notice Round-up ETH transaction with automatic payment split
     * @param _recipient Address to receive the primary payment
     * @param _primaryAmount Primary payment amount in ETH
     * @param _primaryTxValueUSD Original transaction value in USD (scaled by 100)
     */
    function roundUpWithTransfer(
        address payable _recipient,
        uint256 _primaryAmount,
        uint256 _primaryTxValueUSD
    ) external payable {
        require(msg.value > _primaryAmount, "Insufficient value");
        require(_recipient != address(0), "Invalid recipient");
        
        // Calculate round-up amount
        uint256 roundUpAmount = msg.value - _primaryAmount;
        require(roundUpAmount > 0, "Round-up must be > 0");
        
        // Transfer primary amount to recipient
        (bool sentToRecipient, ) = _recipient.call{value: _primaryAmount}("");
        require(sentToRecipient, "Transfer to recipient failed");
        
        // Store round-up amount
        UserSettings storage settings = userSettings[msg.sender];
        
        userBalances[msg.sender].pendingRoundUp += roundUpAmount;
        userTokenBalances[msg.sender].pendingRoundUp[NATIVE_TOKEN] += roundUpAmount;
        
        emit RoundUpCollected(msg.sender, NATIVE_TOKEN, roundUpAmount, _primaryTxValueUSD);
        
        if (settings.autoInvest && userBalances[msg.sender].pendingRoundUp >= MIN_INVEST_AMOUNT) {
            _invest(msg.sender);
        }
    }
    
    /**
     * @notice Round-up ETH transaction
     * @param _primaryTxValueUSD Original transaction value in USD (scaled by 100, e.g., $3.40 = 340)
     */
    function roundUp(uint256 _primaryTxValueUSD) external payable {
        require(msg.value > 0, "Amount must be > 0");
        
        UserSettings storage settings = userSettings[msg.sender];
        
        userBalances[msg.sender].pendingRoundUp += msg.value;
        userTokenBalances[msg.sender].pendingRoundUp[NATIVE_TOKEN] += msg.value;
        
        emit RoundUpCollected(msg.sender, NATIVE_TOKEN, msg.value, _primaryTxValueUSD);
        
        if (settings.autoInvest && userBalances[msg.sender].pendingRoundUp >= MIN_INVEST_AMOUNT) {
            _invest(msg.sender);
        }
    }
    
    /**
     * @notice Round-up ERC20 token transaction
     * @param _token Token address
     * @param _amount Round-up amount in tokens
     * @param _primaryTxValueUSD Original transaction value in USD
     */
    function roundUpToken(address _token, uint256 _amount, uint256 _primaryTxValueUSD) external {
        require(_token != NATIVE_TOKEN, "Use roundUp for ETH");
        require(supportedTokens[_token].isSupported, "Token not supported");
        require(_amount > 0, "Amount must be > 0");
        
        // Transfer tokens from user to contract
        require(IERC20(_token).transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        
        userTokenBalances[msg.sender].pendingRoundUp[_token] += _amount;
        
        emit RoundUpCollected(msg.sender, _token, _amount, _primaryTxValueUSD);
    }
    
    // ============================
    // INVESTMENT FUNCTIONS
    // ============================
    
    /**
     * @notice Manually invest pending round-up balance
     * @dev Can only invest if balance >= MIN_INVEST_AMOUNT
     */
    function invest() external {
        require(userBalances[msg.sender].pendingRoundUp > 0, "No pending round-up");
        require(userBalances[msg.sender].pendingRoundUp >= MIN_INVEST_AMOUNT, "Amount too small to invest");
        _invest(msg.sender);
    }
    
    /**
     * @notice Internal function to invest user's pending balance
     * @param _user Address of the user
     */
    function _invest(address _user) internal {
        uint256 amount = userBalances[_user].pendingRoundUp;
        require(amount > 0, "Nothing to invest");
        
        // Check minimum amount for investment strategy
        if (amount < MIN_INVEST_AMOUNT) {
            // Keep pending if too small
            return;
        }
        
        userBalances[_user].pendingRoundUp = 0;
        
        uint256 investedValue = strategy.deposit{value: amount}(_user);
        userBalances[_user].invested += investedValue;
        
        emit Invested(_user, amount, investedValue);
    }
    
    /**
     * @notice Withdraw invested funds
     * @param _amount Amount to withdraw (in shares)
     */
    function withdraw(uint256 _amount) external {
        require(_amount > 0, "Amount must be > 0");
        require(userBalances[msg.sender].invested >= _amount, "Insufficient invested balance");
        
        userBalances[msg.sender].invested -= _amount;
        
        uint256 ethReturned = strategy.withdraw(msg.sender, _amount);
        
        (bool success, ) = msg.sender.call{value: ethReturned}("");
        require(success, "ETH transfer failed");
        
        emit Withdrawn(msg.sender, _amount, ethReturned);
    }
    
    /**
     * @notice Withdraw pending ERC20 tokens (not invested yet)
     * @param _token Token address
     * @param _amount Amount to withdraw
     */
    function withdrawToken(address _token, uint256 _amount) external {
        require(_token != NATIVE_TOKEN, "Use withdraw for ETH");
        require(_amount > 0, "Amount must be > 0");
        require(userTokenBalances[msg.sender].pendingRoundUp[_token] >= _amount, "Insufficient balance");
        
        userTokenBalances[msg.sender].pendingRoundUp[_token] -= _amount;
        
        require(IERC20(_token).transfer(msg.sender, _amount), "Transfer failed");
    }
    
    // ============================
    // VIEW FUNCTIONS
    // ============================
    
    /**
     * @notice Get user's pending token balance
     * @param _user User address
     * @param _token Token address
     * @return balance Pending balance of the token
     */
    function getUserTokenBalance(address _user, address _token) external view returns (uint256) {
        return userTokenBalances[_user].pendingRoundUp[_token];
    }
    
    /**
     * @notice Get user's current investment value
     * @param _user User address
     * @return value Current value including accrued interest
     */
    function getUserInvestmentValue(address _user) external view returns (uint256) {
        return strategy.getUserValue(_user);
    }
    
    // ============================
    // ADMIN FUNCTIONS
    // ============================
    
    /**
     * @notice Emergency withdraw all ETH to owner
     * @dev Only callable by owner in case of emergency
     */
    function emergencyWithdraw() external onlyOwner {
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }
    
    /**
     * @notice Update investment strategy
     * @param _newStrategy Address of new strategy contract
     */
    function updateStrategy(address _newStrategy) external onlyOwner {
        strategy = IInvestmentStrategy(_newStrategy);
        emit StrategyUpdated(_newStrategy);
    }
    
    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}
