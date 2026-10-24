# Security Specification — BhujalSetu Firestore Security

## 1. Data Invariants
- Users can only read and write their own UserProfile (`/users/{userId}`).
- CommunityActions (`/community_actions/{actionId}`) can be read by all authenticated users to foster community transparency. Write operations must be tied to the authenticated user ID (`incoming().userId == request.auth.uid`). Once completed, status cannot be modified except by creator or admin.
- WaterPledges (`/water_pledges/{pledgeId}`) can be read by all authenticated users for community participation counting. Pledges can only be created by the authenticated owner (`incoming().userId == request.auth.uid`).
- FieldObservations (`/field_observations/{observationId}`) can be read by authenticated users. Creation must match `request.auth.uid`. Updates can only modify status/notes by original reporter or admin.
- Admin email bootstrap: `ynsmohit1412@gmail.com`.

## 2. Dirty Dozen Payloads Handled
1. Identity spoofing: `userId` does not match `request.auth.uid`. Rejected.
2. Shadow fields injection: ghost property e.g. `isAdmin: true` on user profile. Rejected.
3. Unbounded payload size: String length exceeding max constraints. Rejected.
4. Non-whitelisted enum state: `status: "hacked"`. Rejected.
5. Path poisoning: Invalid regex or over-long IDs. Rejected.
6. Temporal forgery: client injecting future or past fake server timestamps. Rejected.
7. Unauthenticated reads or blanket anonymous writes. Rejected.
8. Modifying immutable ID or ownerId fields on update. Rejected.
9. Privilege escalation on user roles. Rejected.
10. Unbounded batch spamming. Rejected.
11. Malformed email injection. Rejected.
12. Terminal status tampering on completed actions. Rejected.
