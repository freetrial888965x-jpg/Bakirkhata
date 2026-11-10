# Security Specification — বাকির খাতা

## 1. Data Invariants
1. **Strict Tenant Isolation**: Every document under `/users/{userId}` (including `customers` and `transactions` subcollections) can ONLY be read or modified by the authenticated user whose `request.auth.uid == userId`.
2. **Authenticated Owner Writes**: All create, update, and delete operations require `request.auth != null && request.auth.uid == userId`, with sensitive edit/delete actions re-authenticated via account password on the client.
3. **Referential & Master Gate Integrity**:
   - A `Customer` cannot be created unless `/users/{userId}` exists and `incoming().userId == userId == request.auth.uid`.
   - A `Transaction` cannot be created unless `/users/{userId}/customers/{customerId}` exists and `incoming().userId == userId` and `incoming().customerId == customerId`.
4. **Immutable Ownership & Creation Timestamps**: `uid`, `userId`, `customerId`, and `createdAt` can never be changed after creation. `createdAt` on create and `updatedAt` on update must equal `request.time`.
5. **Strict Schema & Boundary Enforcement**:
   - `hasAll` + `hasOnly` prevents shadow/ghost fields.
   - All document IDs (`userId`, `customerId`, `transactionId`) match `^[a-zA-Z0-9_\-]+$` and length `<= 128`.
   - `Transaction.type` must be strictly `'due'` or `'payment'`; `Transaction.amount` must be `> 0` and `<= 100000000`.
   - `totalDue` and `totalPayment` on `Customer` must be `>= 0` and initialized to `0` on creation.
6. **No Blanket List Scraping**: `/users` cannot be listed (`allow list: if false`). `customers` and `transactions` list rules verify `resource.data.userId == request.auth.uid`.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Return PERMISSION_DENIED)
1. **Cross-Tenant Read**: User A attempts `get(/users/userB/customers/cust1)`.
2. **Cross-Tenant List**: User A attempts `list(/users/userB/customers)` without matching `userId`.
3. **Users Directory Scraping**: Authenticated User A attempts `list(/users)`.
4. **Identity Spoofing on Create**: User A attempts creating `/users/userA/customers/c1` with `{ userId: "userB", ... }`.
5. **Shadow / Ghost Field Injection**: User A attempts creating a customer with an extra field `{ isAdmin: true }`.
6. **Client Timestamp Forgery**: User A attempts creating a transaction with a backdated `createdAt` instead of `request.time`.
7. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts creating a customer.
8. **Negative / Zero Transaction Amount**: User A creates a transaction with `amount: -500` or `amount: 0`.
9. **Invalid Transaction Type**: User A creates a transaction with `type: "refund"`.
10. **Immutable Field Mutation**: User A updates a transaction attempting to change `customerId` or `createdAt`.
11. **Oversized String / Resource Poisoning**: User A submits a 50KB `note` (`> 300` chars) or invalid document ID `../evil`.
12. **Orphaned Transaction**: User A attempts creating `/users/userA/customers/nonExistentCust/transactions/t1`.
