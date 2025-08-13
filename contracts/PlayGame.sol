// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PlayGame is Ownable, ReentrancyGuard {
    IERC20 public gameToken;
    address public operator;

    enum MatchStatus { NONE, CREATED, STAKED, SETTLED, REFUNDED }

    struct Match {
        address p1;
        address p2;
        uint256 amountStake; // clearly differentiated from function/event parameters
        MatchStatus status;
        uint256 startTime;
    }

    mapping(bytes32 => Match) public matches;
    mapping(bytes32 => mapping(address => bool)) public hasStaked;

    // Events use explicit names to avoid confusion
    event MatchCreated(bytes32 indexed matchId, address p1, address p2, uint256 amountStake);
    event PlayerStaked(bytes32 indexed matchId, address player, uint256 amountStake);
    event MatchSettled(bytes32 indexed matchId, address winner, uint256 payout);
    event MatchRefunded(bytes32 indexed matchId);

    constructor(address _gameToken, address _operator) Ownable(msg.sender) {
        gameToken = IERC20(_gameToken);
        operator = _operator;
    }

    // createMatch parameter renamed to matchStake for clarity
    function createMatch(bytes32 matchId, address p1, address p2, uint256 matchStake) external onlyOwner {
        require(matches[matchId].status == MatchStatus.NONE, "Match exists");
        matches[matchId] = Match(p1, p2, matchStake, MatchStatus.CREATED, 0);
        emit MatchCreated(matchId, p1, p2, matchStake);
    }

    function stake(bytes32 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.CREATED || m.status == MatchStatus.STAKED, "Invalid status");
        require(msg.sender == m.p1 || msg.sender == m.p2, "Not a player");
        require(!hasStaked[matchId][msg.sender], "Already staked");

        require(gameToken.transferFrom(msg.sender, address(this), m.amountStake), "GT transfer failed");
        hasStaked[matchId][msg.sender] = true;

        if (hasStaked[matchId][m.p1] && hasStaked[matchId][m.p2]) {
            m.status = MatchStatus.STAKED;
            m.startTime = block.timestamp;
        }
        emit PlayerStaked(matchId, msg.sender, m.amountStake);
    }

    function commitResult(bytes32 matchId, address winner) external nonReentrant {
        Match storage m = matches[matchId];
        require(msg.sender == operator, "Not operator");
        require(m.status == MatchStatus.STAKED, "Not ready");
        require(winner == m.p1 || winner == m.p2, "Invalid winner");

        uint256 payout = m.amountStake * 2;
        require(gameToken.transfer(winner, payout), "GT payout failed");

        m.status = MatchStatus.SETTLED;
        emit MatchSettled(matchId, winner, payout);
    }

    function refund(bytes32 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.CREATED || m.status == MatchStatus.STAKED, "Not refundable");
        require(block.timestamp > m.startTime + 1 days, "Too early");

        if (hasStaked[matchId][m.p1]) {
            gameToken.transfer(m.p1, m.amountStake);
        }
        if (hasStaked[matchId][m.p2]) {
            gameToken.transfer(m.p2, m.amountStake);
        }
        m.status = MatchStatus.REFUNDED;
        emit MatchRefunded(matchId);
    }
}
