# Standalone implementation verification · 2026-11-04

TASK-259/260/261/262 · SPEC-104–140 · local Windows, Node 24.18.0.

The native HTTP/SQLite implementation is provided locally. Origin deployment,
real Access policies and browser acceptance are separate pending evidence.

| Check | Actual result | Scope |
| --- | --- | --- |
| Product Python | 9 passed | Exact clean hub pin and template equality; bridge and public-content policy |
| Node suite | 98 passed | Existing Worker tests plus five standalone tests |
| Worker dry build | passed, 184.85 KiB / gzip 46.81 KiB | Worker path retained; no deployment |
| OpenAPI and six existing external checks | passed | Pinned contract tools; no account credentials |
| Standalone Schemathesis 3.39.16 | 32 operations passed in 18.02 s; 154/154 for each of five checks | Three generated examples per operation plus explicit examples; real TCP/SQLite with generated RSA assertion |

Standalone tests verify loopback binding, valid user/agent classification,
signature/issuer/audience/expiry/not-before refusal, retained Worker context
requirement, discussion/checkpoint writes, HEAD, cross-site refusal, oversized
request refusal and a usable next connection. They exercise atomic DDL/data
rollback, file reopening and a consistent live-WAL backup restored separately,
receipt tamper refusal and 30-day retention without deleting unrelated files.

During implementation, early oversized-body refusal left the incoming stream
paused, and a copied WAL database could leave sidecars. Both were reproduced
and corrected before this receipt: cancel/drain unconsumed bodies, and seal
completed backup copies in DELETE journal mode before hashing them.

The public-content checker now recognizes only the exact reviewed systemd dev
unit names in the two READMEs and dev installer; other mailbox matches remain
refused. The same rule is used for historical blobs.

Pending: Linux CI, actual origin service/Tunnel, restart/rollback, origin backup
restore, production D1 export rehearsal and maximum-push processing/RSS. No
release or finished-screen performance is claimed by this local run.
