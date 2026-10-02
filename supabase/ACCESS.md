# League accounts and permission codes

Accounts use a unique case-insensitive username and a password. Real email is not required. The server-only `league-auth` function maps each username to an internal reserved-domain identifier and uses Supabase Auth to store and verify passwords. It does not log credentials. Password recovery by email is not available for these accounts yet.

The frontend contains only a public project URL and publishable key. Keep service-role/secret keys on the server.

## First commissioner login

In the project dashboard SQL Editor, run this privately:

```sql
select code from league_private.setup_receipt
where purpose = 'Initial commissioner code';
```

Copy it into the optional commissioner-code field when creating or signing into your website account. The first successful use binds the commissioner code to that account. Do not share it. Blank-code login and the account dialog's blank-code Update Session Access button select ordinary fantasy-participant access.

The bootstrap receipt is accessible only to database administrators, not the website API. Permission checks use a SHA-256 code hash and a live Supabase session. No literal permission code is stored in source control.

## GM changes

The commissioner panel has ten code slots. Assign an official team name and create its code. Pending slots do not grant access. Test teams are not automatically imported as official teams.

Regenerate GM Code replaces the code, increments its version, and removes all elevated grants for that slot in the same transaction. Old browser sessions cannot make privileged requests afterward, even before their UI refreshes. Regular accounts and fantasy memberships are unaffected. The new code is displayed once; copy it and share it privately with the GM. Coaches can use the same GM code with their own individual accounts.

`league_session_access` and permission-checked RPCs are the authority, not localStorage or editable user metadata. Future roster/trade/upload operations must validate the same live session access on the server; the current commissioner UI covers code management. Those operations are not implemented by this migration.

## Deployment and verification

Apply 001 and 002, then the timestamped access-code migration. The migration generates the commissioner bootstrap code in Postgres. Deploy `supabase/functions/league-auth/index.ts`. The dashboard deployment has platform JWT/API-key verification enabled. The endpoint handles username validation and rate limiting before invoking Auth. Existing email-confirmation settings remain unchanged.

`src/supabase-config.json` contains the public project connection only; environment settings can override it.

Run `supabase/tests/access_codes.sql` in the dashboard SQL Editor. It verifies participant access, commissioner binding, GM scope, code rotation, session revocation, rate limits, and private code visibility inside a transaction that rolls back all test data. It never prints real permission codes.
