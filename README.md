# Iron Throne Consensus - DAO Voting System

## Introduction

Iron Throne Consensus is a decentralized decision-making platform inspired by the complex political landscapes of fantasy realms. Built on the Solana blockchain with the Anchor framework, this application allows members of the realm to propose decrees, cast their votes, and influence the governance of their community with transparency and fairness.

## Core Features

-   **Decree Proposals**: Lords and Ladies can propose new decrees detailing strategies, laws, or actions for the realm, specifying staked rewards in SOL for voter participation.
-   **Cast Votes**: Citizens of the realm can support or oppose active decrees, their influence weighted by their staked contribution.
-   **Reward Distribution**: Upon the conclusion of voting, rewards are proportionally distributed among the supporters of the decree based on the outcome and their level of participation.
-   **Decree Outcomes**: Detailed results of each voting session are displayed, showing not just the counts but the calculated impact and consensus level.

## DAO Voting System

The development of the DAO Voting program encompasses several core functionalities:

-   **Create a DAO Voting System using Anchor:** ✅
    -   Users can create proposals specifying the reward pool in SOL.
-   **Implement a Voting System and Display Results:** ✅
    -   Proposals can be created with or without a reward pool;
    -   Users can vote on active proposals;
    -   Creators can finalize proposals to distribute rewards.
        -   Rewards are distributed proportionally among voters based on the number of votes (For a reward pool of 100 SOL, if 10 users vote, each user receives 10 SOL).
        -   The system calculates the result of the voting, displaying detailed results including the total votes for each option and their respective percentages.
-   **Optionally, Add Privacy Voting Using ZK Proofs or Verifiable Compute:** 🔜
-   **Reward Points to Users for Voting Participation:** ✅
    -   Rewards are distributed to voters based on their participation, with rewards being proportional to the number of votes.

## Getting Started

### Prerequisites

-   Install [Anchor](https://www.anchor-lang.com/docs/installation)
    -   Use version `0.29.0` for compatibility with the program
    -   `avm install 0.29.0 && avm use 0.29.0`

### Running the Tests

Execute the tests to see the DAO Voting system in action:

```bash
yarn
anchor build
anchor test
```
