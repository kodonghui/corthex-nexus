# Rebuild operator interfaces

[한국어](operator.ko.md)

| ID | Interface | From | Access | Outcomes |
| --- | --- | --- | --- | --- |
| API-237 | Protected backup and inventory | SPEC-341, SPEC-342 | operator-only local command | consistent protected manifest with original IDs/digests and accepted-write boundary |
| API-238 | Restore and reconcile legacy data | SPEC-341, SPEC-342, SPEC-343 | operator-only isolated migration command | mapped identities, counts, foreign-key and protected content checks; blocked on mismatch |
| API-239 | Validate and switch or keep release | SPEC-345 | operator-only release command | recorded keep/switch after all Must QA and recovery evidence |
| API-240 | Recover acknowledged writes | SPEC-344 | operator-only rollback command | compatible runtime and reconciled journal tail; incomplete if any acknowledged write is missing |
| API-241 | hub.py setup-ci PROJECT | SPEC-331, SPEC-327, SPEC-328 | authorized local harness CLI | environment-only gh secret set; safe skip/partial/configured result and workflow PR when absent |

Operator commands use a local protected account. Real paths, backups, logs and credentials stay on that server or protected session. Harness 0.5.0 configured Actions for the three existing repositories, and fresh runs had acknowledged deliveries. Release qualification uses the exact candidate commit.

## Isolated operator rehearsal

Use Node 24 and owner-only files. Run each backup or recovery in a fresh mode-0700 output directory. Restore into an isolated v2 database with the already verified owner records. Keep the protected legacy archive alongside the native view. Legacy format, original IDs, source references and unsupported records are available in that archive.

```sh
node nexus/src/rebuild-operator.js backup-legacy /protected/live.sqlite /protected/legacy-inventory
node nexus/src/rebuild-operator.js import-legacy /protected/legacy-inventory/legacy.sqlite /protected/legacy-inventory/inventory.json /protected/owner-map.json /protected/candidate.sqlite
node nexus/src/rebuild-operator.js backup-rebuild /protected/candidate.sqlite /protected/baseline
node nexus/src/rebuild-operator.js recover /protected/baseline/rebuild.sqlite /protected/baseline/baseline.json /protected/frozen/rebuild.sqlite /protected/recovery
node nexus/src/rebuild-operator.js check-release /protected/release-evidence.json MAIN_COMMIT
```

The inventory records schema and counts, original IDs and row digests, snapshot item digests and the last legacy write boundary. The owner map lists each legacy project by name with its verified `owner_id`, GitHub `repository_url` and `default_branch`. The candidate import verifies the backup against the complete protected inventory and records native and archived mappings. Replay applies transaction changesets and checks every acknowledged result digest against its receipt. Missing or conflicting rows roll back the replay transaction.

Imported checkpoint decisions keep their original IDs and time order, including repeated passes and withdrawals. Same-commit discussions keep their items in each reviewed part. Named repository references use the original repository and commit from the archived snapshot. The first verified v2 publication may use the imported held commit and adds a new revision to its history.

Recovery compares the complete acknowledged journal prefix in both backups before applying later writes. The recovered database revokes restored owner sessions and consumes pending sign-in attempts. Sign in again after switching to the recovered runtime.

The release evidence index names the exact candidate and each protected report with its SHA-256 digest. The check validates API, browser, performance, migration, recovery, compatibility, preview, OIDC, publication and owner checkpoint results. It returns a keep decision until all reports meet their acceptance conditions. The separately configured service unit and environment example are in `nexus/ops/`.

The development rehearsal used three synthetic legacy projects and restored two writes acknowledged after backup. The production inventory, actual owner mapping, live migration and routing switch require protected server access.
