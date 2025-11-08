// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IInvestmentStrategy
 * @notice Interface for investment strategy contracts
 */
interface IInvestmentStrategy {
    /**
     * @notice Deposits ETH and invests according to strategy
     * @param _user The user's address
     * @return amountInvested The amount successfully invested (in USD value with 6 decimals)
     */
    function deposit(address _user) external payable returns (uint256 amountInvested);

    /**
     * @notice Withdraws user's investment
     * @param _user The user's address
     * @param _amount The amount to withdraw in USD (6 decimals)
     * @return ethReturned The amount of ETH returned to user
     */
    function withdraw(address _user, uint256 _amount) external returns (uint256 ethReturned);

    /**
     * @notice Returns the current value of user's investment in USD (6 decimals)
     * @param _user The user's address
     * @return currentValue The current investment value
     */
    function getUserValue(address _user) external view returns (uint256 currentValue);
}
