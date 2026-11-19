# Security Specification — BhujalSetu Local PostgreSQL & Express Backend

## 1. Data & Authentication Invariants
- **Local Secure Authentication:** User accounts are stored in PostgreSQL (`users` table) with passwords hashed using `crypto.scryptSync` with cryptographic random salt. Signatures use HMAC-SHA256 signed bearer tokens with secret configured via `JWT_SECRET`.
- **Closed Membership Enrollment:** Registration does not automatically grant active village membership. Telemetry read endpoints strictly enforce `status = 'active'` in `community_memberships`. Administrator approval/provisioning is required.
- **Node Device Authentication:** IoT sensor intake endpoints (`POST /api/v1/telemetry`) require matching Bearer device API keys (`NODE_1_DEVICE_API_KEY`, `NODE_2_DEVICE_API_KEY`). Cross-node key impersonation is rejected.
- **Telemetry Integrity:** The live dashboard accepts only measured packets (`dataSource: 'measured'`).
- **No GEM/Token Accrual:** GEMs and Water Credits are a proposed conceptual model only. No token calculation, award, balance, or ledger writes exist.
- **Auditable Admin Purge:** Raw sensor telemetry can be exported and purged only via manual, administrator-only CLI command requiring explicit confirmation (`--confirm`).

## 2. Invariants & Security Defenses
1. Identity spoofing: `userId` does not match token subject. Rejected.
2. Unauthenticated reads of telemetry history or member actions. Rejected with HTTP 401.
3. Non-member village data access: Users cannot read telemetry for villages where they lack active membership. Rejected with HTTP 403.
4. Unbounded payload size: Express JSON parser limited to 1MB.
5. Ingestion validation: Discriminated Zod schemas for Node 1 and Node 2.
6. Table integrity: Direct SQL parameterization prevents injection.
7. Device key impersonation: Node 1 key cannot submit Node 2 packets and vice versa.
8. No hardcoded secrets: JWT secret and device keys must be configured via environment.
