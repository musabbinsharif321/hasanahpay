# Firestore Security Specification (Hasanah Tech Solutions)

## 1. Data Invariants
1. **Strict PII & Role Isolation (`/users/{userId}`)**: Clients may only read their own user document (`request.auth.uid == userId`). Only admins may list all client profiles, create client accounts, or assign `role: "admin"`.
2. **Subscription Ownership (`/subscriptions/{subscriptionId}`)**: Clients may only read/list subscriptions where `clientId == request.auth.uid`. Clients can only transition `status` from `"active"` or `"due"` to `"pending_verification"`, and cannot alter `amount`, `billingCycle`, `nextDueDate`, or `clientId`.
3. **Payment Integrity & Duplicate TrxID Prevention (`/payments/{paymentId}` & `/trxIds/{trxId}`)**: A client can only create a `"pending"` payment for a subscription they own, with server-enforced `submittedAt == request.time`, and must atomically create `/trxIds/{trxId}` in the same `writeBatch`. Only admins may transition payment `status` from `"pending"` to `"approved"` or `"rejected"`.
4. **Immutable Digital Invoices (`/invoices/{invoiceId}`)**: Only admins can create invoices; invoices cannot be modified or deleted once issued. Clients can only read/list their own invoices (`clientId == request.auth.uid`).
5. **Agency Receiving Accounts (`/settings/paymentAccounts`)**: Authenticated users may read `paymentAccounts`, while only admins may create or update MFS wallet configurations, the bounded corporate bank accounts list (1–6 validated banks), and agency contact info.

## 2. Dirty Dozen Adversarial Payloads (Expected: `PERMISSION_DENIED`)
1. **Unauthenticated read on `/subscriptions` or `/users`**: Missing `request.auth`.
2. **Client reading another client's `/users/{otherUid}`**: Violates `isOwner(userId) || isAdmin()`.
3. **Client self-escalating `role` to `"admin"` on `/users/{uid}`**: Blocked by role immutability and admin-only creation.
4. **Client creating a payment with `status: "approved"`**: Blocked by `incoming().status == 'pending'`.
5. **Client creating a payment with spoofed `clientId` belonging to another user**: Blocked by `incoming().clientId == request.auth.uid`.
6. **Client creating a payment without atomic `/trxIds/{trxId}` lock**: Blocked by `existsAfter(...)`.
7. **Client reusing an already-submitted `trxId`**: Blocked by `!exists(/trxIds/{trxId})` / document creation failure.
8. **Client modifying subscription `amount` or `nextDueDate` during payment submission**: Blocked by `affectedKeys().hasOnly(['status'])`.
9. **Client adding a shadow field (`isVerified: true`) to payment or subscription**: Blocked by `keys().hasOnly(...)`.
10. **Client approving their own pending payment**: Blocked by `isAdmin()` check on `payments` update.
11. **Client modifying `/settings/paymentAccounts` to hijack bKash number or bank routing**: Blocked by `isAdmin()` check on `settings`.
12. **Oversized 1MB string or >6 unbounded bank entries injected into `/settings/paymentAccounts` or `trxId`**: Blocked by `isValidId()`, `.size()`, and bounded list validation (`banks.size() <= 6`).
