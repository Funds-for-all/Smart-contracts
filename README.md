# Smart-contracts

| Function        | Purpose                       | Status                                |
| --------------- | ----------------------------- | ------------------------------------- |
| `createPool`    | Create a pool with candidates | ✅ Looks good                          |
| `fundPool`      | Fund a pool with ETH          | ✅ Solid                               |
| `vote`          | Vote for a candidate          | ✅ Good; enforces one vote per address |
| `withdraw`      | Withdraw to top-voted         | ✅ Functional logic                    |
| `getCandidates` | View all candidates           | ✅ View function OK                    |
| `getVoteCount`  | View votes per candidate      | ✅ Simple and useful                   |
| `poolCount`     | Track number of pools         | ✅ Works                               |
| `pools`         | Mapping to each pool          | ✅ Accessible                          |




## Tests results 
✔ should create a new pool
✔ should allow funding
✔ should allow voting and withdrawal
✔ should not allow double voting
✔ should not allow withdrawal before any votes
✔ should reject invalid candidate vote
✔ should emit events correctly (100ms)


## note: https://kleros.io/integrations 
