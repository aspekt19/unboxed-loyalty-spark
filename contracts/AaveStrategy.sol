// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IInvestmentStrategy.sol";

/**
 * @title AaveStrategy
 * @notice Conservative strategy - deposits into Aave V3 USDC
 * @dev Simplified MVP version for Base Sepolia
 */

// External Interfaces
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
}

contract AaveStrategy is IInvestmentStrategy {
    // Base Sepolia addresses
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e; // Base Sepolia USDC
    address public constant AAVE_POOL = 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5;
    address public constant DEX_ROUTER = 0x1689E7B1F10000AE47eBfE339a4f69dECd19F602; // Uniswap V2 Router on Base Sepolia
    
    address public immutable vault;
    
    // Track user deposits (in USDC amount with 6 decimals)
    mapping(address => uint256) public userDeposits;
    
    event Deposited(address indexed user, uint256 ethAmount, uint256 usdcAmount);
    event Withdrawn(address indexed user, uint256 usdcAmount, uint256 ethAmount);
    
    modifier onlyVault() {
        require(msg.sender == vault, "Only vault can call");
        _;
    }
    
    constructor(address _vault) {
        vault = _vault;
        
        // Approve DEX to spend WETH
        IERC20(WETH).approve(DEX_ROUTER, type(uint256).max);
        // Approve Aave to spend USDC
        IERC20(USDC).approve(AAVE_POOL, type(uint256).max);
    }
    
    /**
     * @inheritdoc IInvestmentStrategy
     */
    function deposit(address _user) external payable onlyVault returns (uint256 amountInvested) {
        require(msg.value > 0, "No ETH sent");
        
        // 1. Wrap ETH to WETH
        IWETH(WETH).deposit{value: msg.value}();
        uint256 wethAmount = msg.value;
        
        // 2. Swap WETH to USDC via DEX
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = USDC;
        
        // Get expected output for slippage protection (allow 2% slippage)
        uint256[] memory amountsOut = IUniswapV2Router(DEX_ROUTER).getAmountsOut(wethAmount, path);
        uint256 minUsdcOut = (amountsOut[1] * 98) / 100; // 2% slippage tolerance
        
        uint256[] memory amounts = IUniswapV2Router(DEX_ROUTER).swapExactTokensForTokens(
            wethAmount,
            minUsdcOut,
            path,
            address(this),
            block.timestamp + 300
        );
        
        uint256 usdcReceived = amounts[1];
        require(usdcReceived > 0, "Swap failed");
        
        // 3. Deposit USDC into Aave (aTokens are minted to this contract)
        IAavePool(AAVE_POOL).supply(USDC, usdcReceived, address(this), 0);
        
        // 4. Track user's deposit
        userDeposits[_user] += usdcReceived;
        
        emit Deposited(_user, msg.value, usdcReceived);
        
        return usdcReceived;
    }
    
    /**
     * @inheritdoc IInvestmentStrategy
     */
    function withdraw(address _user, uint256 _amount) external onlyVault returns (uint256 ethReturned) {
        require(_amount > 0, "Amount must be > 0");
        require(userDeposits[_user] >= _amount, "Insufficient balance");
        
        // 1. Withdraw USDC from Aave
        uint256 usdcWithdrawn = IAavePool(AAVE_POOL).withdraw(USDC, _amount, address(this));
        
        // 2. Swap USDC back to WETH
        address[] memory path = new address[](2);
        path[0] = USDC;
        path[1] = WETH;
        
        // Approve DEX to spend USDC if needed
        IERC20(USDC).approve(DEX_ROUTER, usdcWithdrawn);
        
        uint256[] memory amountsOut = IUniswapV2Router(DEX_ROUTER).getAmountsOut(usdcWithdrawn, path);
        uint256 minWethOut = (amountsOut[1] * 98) / 100; // 2% slippage
        
        uint256[] memory amounts = IUniswapV2Router(DEX_ROUTER).swapExactTokensForTokens(
            usdcWithdrawn,
            minWethOut,
            path,
            address(this),
            block.timestamp + 300
        );
        
        uint256 wethReceived = amounts[1];
        
        // 3. Unwrap WETH to ETH
        IWETH(WETH).withdraw(wethReceived);
        
        // 4. Send ETH to vault (vault will forward to user)
        (bool success, ) = vault.call{value: wethReceived}("");
        require(success, "ETH transfer failed");
        
        // 5. Update user balance
        userDeposits[_user] -= _amount;
        
        emit Withdrawn(_user, _amount, wethReceived);
        
        return wethReceived;
    }
    
    /**
     * @inheritdoc IInvestmentStrategy
     */
    function getUserValue(address _user) external view returns (uint256 currentValue) {
        // In Aave, aTokens grow in balance over time as interest accrues
        // For simplicity, we return the tracked deposit amount
        // In production, you'd query the actual aToken balance
        return userDeposits[_user];
    }
    
    // Receive ETH from WETH unwrap and vault
    receive() external payable {}
}
