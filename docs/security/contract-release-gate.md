# Contract Release Security Gate

Mainnet or production testnet deployment is blocked until all checks below pass.

## Required Checks

- Run `forge test` from `contracts/`.
- Run `slither . --filter-paths "lib|test|script"` from `contracts/`.
- Set `MULTISIG_ADMIN` to the production multisig address before `BROADCAST=true` deployment.
- Set `THIRD_PARTY_AUDIT_REPORT` to a signed third-party audit report file.
- Run `contracts/scripts/security-gate.sh` in CI or before release.

## Multisig Requirement

`contracts/script/Deploy.s.sol` requires `MULTISIG_ADMIN` when `BROADCAST=true`.
After deployment it grants `DEFAULT_ADMIN_ROLE`, `MARKET_CREATOR_ROLE`, and `PAUSER_ROLE` on `MarketFactory` to the multisig and revokes those roles from the deployer.
For standalone markets, it grants `DEFAULT_ADMIN_ROLE` and `ADMIN_ROLE` to the multisig and revokes deployer admin roles.

## Third-Party Audit Requirement

The audit report must be produced by an external reviewer and stored outside generated build output.
The release operator must set:

```shell
export THIRD_PARTY_AUDIT_REPORT=/absolute/path/to/signed-audit-report.pdf
```

The security gate verifies the file exists but does not replace human review of audit findings.
