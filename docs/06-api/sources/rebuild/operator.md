# Rebuild operator interfaces

[한국어](operator.ko.md)

| ID | Interface | From | Access | Outcomes |
| --- | --- | --- | --- | --- |
| API-237 | Protected backup and inventory | SPEC-341, SPEC-342 | operator-only local command | consistent protected manifest with original IDs/digests and accepted-write boundary |
| API-238 | Restore and reconcile legacy data | SPEC-341, SPEC-342, SPEC-343 | operator-only isolated migration command | mapped identities, counts, foreign-key and protected content checks; blocked on mismatch |
| API-239 | Validate and switch or keep release | SPEC-345 | operator-only release command | recorded keep/switch after all Must QA and recovery evidence |
| API-240 | Recover acknowledged writes | SPEC-344 | operator-only rollback command | compatible runtime and reconciled journal tail; incomplete if any acknowledged write is missing |
| API-241 | hub.py setup-ci PROJECT | SPEC-331, SPEC-327, SPEC-328 | authorized local harness CLI | environment-only gh secret set; safe skip/partial/configured result and workflow PR when absent |

Operator commands are not public HTTP routes. Real paths, backups, logs and credentials remain on the protected server or current session, outside Git and user receipts. Migration/switch/recovery still need implementation and rehearsal. Authorized CI setup exists in harness 0.5.0, but current GitHub Secrets 403 prevents actual secret configuration and automatic delivery.
