# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **User Profile Ownership & Role Integrity**: A user document at `/users/{userId}` can only be created by the verified owner (`request.auth.uid == userId`), and non-admin creators MUST have `role == 'user'`, `subscriptionStatus == 'NONE'`, and `expiresAt == 0`.
2. **Subscription Anti-Spoofing**: Users cannot self-assign `subscriptionStatus == 'ACTIVE'`, `expiresAt > 0`, `approvedAt`, or `role == 'admin'`. Only a verified Admin can approve subscriptions or grant access days.
3. **PII Isolation**: User profiles (`/users/{userId}`) contain email and phone PII; `get` is restricted strictly to `isOwner(userId) || isAdmin()`, and `list` is strictly restricted to `isAdmin()`.
4. **Subscription Request Ownership**: Users can only create `/subscriptionRequests/{requestId}` with `userId == request.auth.uid` and `status == 'PENDING'`, and can only read/list their own requests (`resource.data.userId == request.auth.uid`) unless `isAdmin()`.
5. **Payment Config Protection**: Payment numbers in `/paymentConfig/{configId}` can be read individually by signed-in users (`get`) and modified solely by `isAdmin()`.
6. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps MUST equal `request.time`.
7. **API Endpoint Config Isolation**: Records in `/apiEndpoints/{endpointId}` require `ownerId == request.auth.uid` on creation, validate strict schema keys/lengths/enums, and permit reads/updates/deletes strictly to the owner or `isAdmin()`.

## 2. The "Dirty Dozen" Attack Payloads (All MUST return PERMISSION_DENIED)
1. **Unauthenticated Read**: Read `/users/user1` when `request.auth == null`.
2. **Self-Admin Escalation**: Create `/users/{uid}` with `role: 'admin'` as a regular Gmail user.
3. **Self-Subscription Spoofing (Create)**: Create `/users/{uid}` with `subscriptionStatus: 'ACTIVE'` and `expiresAt: 9999999999999`.
4. **Self-Subscription Spoofing (Update)**: Update `/users/{uid}` changing `subscriptionStatus` to `'ACTIVE'` or increasing `expiresAt`.
5. **Shadow Field Injection**: Create `/users/{uid}` with an undeclared ghost field `isSuperVip: true`.
6. **Email Spoofing**: Authenticate with unverified email (`email_verified: false`) matching admin email and attempt admin write.
7. **Cross-User PII Leak (Get)**: Regular user A tries `get` on `/users/userB`.
8. **Blanket User List Scraping**: Regular user tries `list` on `/users`.
9. **Request Forgery for Another User**: User A creates `/subscriptionRequests/req1` with `userId: 'userB'`.
10. **Pre-Approved Request Injection**: User A creates `/subscriptionRequests/req1` with `status: 'APPROVED'`.
11. **Oversized Resource Exhaustion**: Create request with `trxId` of length > 100 or invalid document ID `../../bad`.
12. **Payment Hijack**: Non-admin user tries to update `/paymentConfig/default` with attacker's bKash number.
