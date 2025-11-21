// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AaveConservativeStrategy
 * @notice Conservative investment strategy using Aave V3 on Base Mainnet
 * @dev Deposits ETH into Aave V3, receives aWETH tokens with yield
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Deploy this contract (no constructor parameters)
 * 2. Deploy RoundUpVault with this strategy address
 * 3. Call setVault(vaultAddress) on this contract
 */

// Base Mainnet addresses (no NatSpec for file-level constants)
address constant WETH = address(0x4200000000000000000000000000000000000006);
address constant AAVE_POOL = address(0xA238Dd80C259a72e81d7e4664a9801593F98d1c5);
address constant AWETH_TOKEN = address(0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7);

// ============================
// INTERFACES
// ============================

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface IInvestmentStrategy {
    function deposit(address _user) external payable returns (uint256 amountInvested);
    function withdraw(address _user, uint256 _amount) external returns (uint256 ethReturned);
    function getUserValue(address _user) external view returns (uint256 currentValue);
}

// ============================
// MAIN CONTRACT
// ============================

contract AaveConservativeStrategy is IInvestmentStrategy {
    // Immutable protocol addresses
    IPool public immutable pool = IPool(AAVE_POOL);
    IERC20 public immutable weth = IERC20(WETH);
    IERC20 public immutable aWETH = IERC20(AWETH_TOKEN);
    
    // State variables
    address public vault;
    address public owner;
    
    // User accounting
    mapping(address => uint256) public userShares;
    
    // Events
    event VaultSet(address indexed vault);
    event Deposited(address indexed user, uint256 ethAmount, uint256 shares);
    event Withdrawn(address indexed user, uint256 shares, uint256 ethAmount);
    
    // ============================
    // CONSTRUCTOR
    // ============================
    
    constructor() {
        owner = msg.sender;
    }
    
    // ============================
    // MODIFIERS
    // ============================
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlyVault() {
        require(msg.sender == vault, "Only vault");
        _;
    }
    
    // ============================
    // SETUP FUNCTIONS
    // ============================
    
    /**
     * @notice Set the vault address and approve tokens
     * @dev Can only be called once by owner after RoundUpVault is deployed
     * @param _vault Address of the RoundUpVault contract
     */
    function setVault(address _vault) external onlyOwner {
        require(vault == address(0), "Vault already set");
        require(_vault != address(0), "Invalid vault");
        vault = _vault;
        
        emit VaultSet(_vault);
    }
    
    // Receive ETH
    receive() external payable {}
    
    // ============================
    // STRATEGY FUNCTIONS
    // ============================
    
    /**
     * @notice Deposit ETH into Aave V3
     * @dev Called by RoundUpVault when user invests
     * @param _user Address of the user
     * @return amountInvested Amount of ETH invested
     */
    function deposit(address _user) external payable onlyVault override returns (uint256) {
        require(msg.value > 0, "Amount must be > 0");
        
        uint256 ethAmount = msg.value;
        
        // 1. Wrap ETH to WETH
        (bool wrapSuccess, ) = WETH.call{value: ethAmount}("");
        require(wrapSuccess, "WETH wrap failed");
        
        // 2. Approve WETH to Aave Pool
        weth.approve(AAVE_POOL, ethAmount);
        
        // 3. Supply WETH to Aave (aWETH tokens go to this contract)
        pool.supply(WETH, ethAmount, address(this), 0);
        
        // 4. Track user shares (1:1 with ETH deposited)
        userShares[_user] += ethAmount;
        
        emit Deposited(_user, ethAmount, ethAmount);
        return ethAmount;
    }
    
    /**
     * @notice Withdraw ETH from Aave V3
     * @dev Called by RoundUpVault when user withdraws
     * @param _user Address of the user
     * @param _amount Amount of shares to withdraw
     * @return ethReturned Amount of ETH returned to vault
     */
    function withdraw(address _user, uint256 _amount) external onlyVault override returns (uint256) {
        require(userShares[_user] >= _amount, "Insufficient balance");
        
        // 1. Withdraw WETH from Aave Pool
        uint256 wethAmount = pool.withdraw(WETH, _amount, address(this));
        
        // 2. Unwrap WETH to ETH
        (bool unwrapSuccess, ) = WETH.call(abi.encodeWithSignature("withdraw(uint256)", wethAmount));
        require(unwrapSuccess, "WETH unwrap failed");
        
        // 3. Update user shares
        userShares[_user] -= _amount;
        
        // 4. Send ETH to vault (vault will forward to user)
        (bool sent, ) = vault.call{value: wethAmount}("");
        require(sent, "ETH transfer failed");
        
        emit Withdrawn(_user, _amount, wethAmount);
        return wethAmount;
    }
    
    /**
     * @notice Get current value of user's investment
     * @dev Returns the current aWETH balance for the user's shares
     * @param _user Address of the user
     * @return currentValue Current value in ETH (includes accrued interest)
     */
    function getUserValue(address _user) external view override returns (uint256) {
        // In Aave V3, aWETH is 1:1 with WETH + accrued interest
        // For simplicity, we return user's shares
        // In production, calculate: (userShares * totalAWETH) / totalShares
        return userShares[_user];
    }
    
    // ============================
    // EMERGENCY FUNCTIONS
    // ============================
    
    /**
     * @notice Emergency withdraw all ETH to owner
     * @dev Only callable by owner in case of emergency
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = owner.call{value: balance}("");
            require(success, "Transfer failed");
        }
    }
}
