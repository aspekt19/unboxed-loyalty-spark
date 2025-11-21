// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// RoundUpVault
// Main contract for Round-Up investment system on Base Mainnet
// MVP version for Base mainnet with ETH round-up and investment strategies
// 
// DEPLOYMENT INSTRUCTIONS:
// 1. Deploy AaveConservativeStrategy and LendingPlusStrategy first
// 2. Deploy this contract with:
//    - _ethPriceFeed: 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70
//    - _aaveStrategy: Address of AaveConservativeStrategy
//    - _compoundStrategy: Address of LendingPlusStrategy
// 3. Call setVault(vaultAddress) on both strategy contracts

// Base Mainnet addresses
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
    
    // Multiple investment strategies
    mapping(Strategy => IInvestmentStrategy) public strategies;
    
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
        Strategy preferredStrategy; // User's preferred investment strategy
    }
    
    struct UserBalance {
        uint256 pendingRoundUp;
        mapping(Strategy => uint256) invested; // Track investments per strategy
    }
    
    struct TokenBalance {
        mapping(address => uint256) pendingRoundUp;
        mapping(address => uint256) invested;
    }
    
    mapping(address => UserSettings) public userSettings;
    mapping(address => UserBalance) private userBalances;
    mapping(address => TokenBalance) private userTokenBalances;
    
    // ============================
    // EVENTS
    // ============================
    event SettingsUpdated(address indexed user, bool autoInvest, uint256 roundUpMultiplier, Strategy preferredStrategy);
    event RoundUpCollected(address indexed user, address indexed token, uint256 roundUpAmount, uint256 primaryTxValue);
    event Invested(address indexed user, Strategy strategy, uint256 amount, uint256 investedValue);
    event Withdrawn(address indexed user, Strategy strategy, uint256 amount, uint256 ethReturned);
    event StrategySet(Strategy indexed strategyType, address indexed strategyAddress);
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
    constructor(address _ethPriceFeed, address _aaveStrategy, address _compoundStrategy) {
        owner = msg.sender;
        
        // Set both strategies
        strategies[Strategy.AAVE_CONSERVATIVE] = IInvestmentStrategy(_aaveStrategy);
        strategies[Strategy.COMPOUND_LENDING_PLUS] = IInvestmentStrategy(_compoundStrategy);
        
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
     * @dev Sets default values: autoInvest=true, multiplier=1, Aave as default strategy
     */
    function initializeSettings() external {
        require(userSettings[msg.sender].roundUpMultiplier == 0, "Already initialized");
        
        userSettings[msg.sender] = UserSettings({
            autoInvest: true,
            roundUpMultiplier: 1,
            preferredStrategy: Strategy.AAVE_CONSERVATIVE
        });
        
        emit SettingsUpdated(msg.sender, true, 1, Strategy.AAVE_CONSERVATIVE);
    }
    
    /**
     * @notice Update user settings
     * @param _autoInvest Enable automatic investment
     * @param _roundUpMultiplier Multiplier for round-up (1-10)
     * @param _preferredStrategy Preferred investment strategy
     */
    function updateSettings(
        bool _autoInvest,
        uint256 _roundUpMultiplier,
        Strategy _preferredStrategy
    ) external {
        require(_roundUpMultiplier > 0 && _roundUpMultiplier <= 10, "Invalid multiplier");
        require(address(strategies[_preferredStrategy]) != address(0), "Strategy not set");
        
        UserSettings storage settings = userSettings[msg.sender];
        settings.autoInvest = _autoInvest;
        settings.roundUpMultiplier = _roundUpMultiplier;
        settings.preferredStrategy = _preferredStrategy;
        
        emit SettingsUpdated(msg.sender, _autoInvest, _roundUpMultiplier, _preferredStrategy);
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
            // Invest immediately using preferred strategy
            Strategy strategyType = settings.preferredStrategy;
            IInvestmentStrategy strategyContract = strategies[strategyType];
            require(address(strategyContract) != address(0), "Strategy not set");
            
            uint256 investedValue = strategyContract.deposit{value: msg.value}(msg.sender);
            userBalances[msg.sender].invested[strategyType] += investedValue;
            
            emit Invested(msg.sender, strategyType, msg.value, investedValue);
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
            _invest(msg.sender, settings.preferredStrategy);
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
            _invest(msg.sender, settings.preferredStrategy);
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
     * @notice Manually invest pending round-up balance with specific strategy
     * @dev Can only invest if balance >= MIN_INVEST_AMOUNT
     * @param _strategy Strategy to use for investment
     */
    function invest(Strategy _strategy) external {
        require(userBalances[msg.sender].pendingRoundUp > 0, "No pending round-up");
        require(userBalances[msg.sender].pendingRoundUp >= MIN_INVEST_AMOUNT, "Amount too small to invest");
        require(address(strategies[_strategy]) != address(0), "Strategy not set");
        _invest(msg.sender, _strategy);
    }
    
    /**
     * @notice Internal function to invest user's pending balance
     * @param _user Address of the user
     * @param _strategyType Strategy to use for investment
     */
    function _invest(address _user, Strategy _strategyType) internal {
        uint256 amount = userBalances[_user].pendingRoundUp;
        require(amount > 0, "Nothing to invest");
        
        // Check minimum amount for investment strategy
        if (amount < MIN_INVEST_AMOUNT) {
            // Keep pending if too small
            return;
        }
        
        IInvestmentStrategy strategyContract = strategies[_strategyType];
        require(address(strategyContract) != address(0), "Strategy not set");
        
        userBalances[_user].pendingRoundUp = 0;
        
        uint256 investedValue = strategyContract.deposit{value: amount}(_user);
        userBalances[_user].invested[_strategyType] += investedValue;
        
        emit Invested(_user, _strategyType, amount, investedValue);
    }
    
    /**
     * @notice Withdraw invested funds from specific strategy
     * @param _strategy Strategy to withdraw from
     * @param _amount Amount to withdraw (in shares)
     */
    function withdraw(Strategy _strategy, uint256 _amount) external {
        require(_amount > 0, "Amount must be > 0");
        require(userBalances[msg.sender].invested[_strategy] >= _amount, "Insufficient invested balance");
        require(address(strategies[_strategy]) != address(0), "Strategy not set");
        
        userBalances[msg.sender].invested[_strategy] -= _amount;
        
        IInvestmentStrategy strategyContract = strategies[_strategy];
        uint256 ethReturned = strategyContract.withdraw(msg.sender, _amount);
        
        (bool success, ) = msg.sender.call{value: ethReturned}("");
        require(success, "ETH transfer failed");
        
        emit Withdrawn(msg.sender, _strategy, _amount, ethReturned);
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
     * @notice Get user's current investment value in specific strategy
     * @param _user User address
     * @param _strategy Strategy to check
     * @return value Current value including accrued interest
     */
    function getUserInvestmentValue(address _user, Strategy _strategy) external view returns (uint256) {
        IInvestmentStrategy strategyContract = strategies[_strategy];
        if (address(strategyContract) == address(0)) return 0;
        return strategyContract.getUserValue(_user);
    }
    
    /**
     * @notice Get user's total investment value across all strategies
     * @param _user User address
     * @return value Total current value including accrued interest
     */
    function getUserTotalInvestmentValue(address _user) external view returns (uint256) {
        uint256 total = 0;
        
        IInvestmentStrategy aaveStrategy = strategies[Strategy.AAVE_CONSERVATIVE];
        if (address(aaveStrategy) != address(0)) {
            total += aaveStrategy.getUserValue(_user);
        }
        
        IInvestmentStrategy compoundStrategy = strategies[Strategy.COMPOUND_LENDING_PLUS];
        if (address(compoundStrategy) != address(0)) {
            total += compoundStrategy.getUserValue(_user);
        }
        
        return total;
    }
    
    /**
     * @notice Get user's invested amount in specific strategy
     * @param _user User address
     * @param _strategy Strategy to check
     * @return amount Invested amount (shares)
     */
    function getUserInvestedAmount(address _user, Strategy _strategy) external view returns (uint256) {
        return userBalances[_user].invested[_strategy];
    }
    
    /**
     * @notice Get user's pending round-up balance
     * @param _user User address
     * @return amount Pending balance
     */
    function getUserPendingBalance(address _user) external view returns (uint256) {
        return userBalances[_user].pendingRoundUp;
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
     * @notice Set or update a specific investment strategy
     * @param _strategyType Type of strategy to set
     * @param _strategyAddress Address of strategy contract
     */
    function setStrategy(Strategy _strategyType, address _strategyAddress) external onlyOwner {
        require(_strategyAddress != address(0), "Invalid strategy address");
        strategies[_strategyType] = IInvestmentStrategy(_strategyAddress);
        emit StrategySet(_strategyType, _strategyAddress);
    }
    
    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}
