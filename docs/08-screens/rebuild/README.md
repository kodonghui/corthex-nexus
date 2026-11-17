# Rebuild screen states

[한국어](README.ko.md)

All applicable states and called API responses for eleven screens. This does not claim real implementation, complete browser QA or a human review pass.

## Screens

| Screen | States | Definition |
| --- | --- | --- |
| SCR-131 | SCR-131#normal, SCR-131#loading, SCR-131#empty, SCR-131#error, SCR-131#permission, SCR-131#stale, SCR-131#auth-pending, SCR-131#expired | [Welcome](SCR-131.md) |
| SCR-132 | SCR-132#normal, SCR-132#loading, SCR-132#empty, SCR-132#error, SCR-132#permission, SCR-132#stale | [Projects](SCR-132.md) |
| SCR-133 | SCR-133#normal, SCR-133#loading, SCR-133#empty, SCR-133#error, SCR-133#permission, SCR-133#stale, SCR-133#consent-required, SCR-133#connected | [Connect project](SCR-133.md) |
| SCR-134 | SCR-134#normal, SCR-134#loading, SCR-134#empty, SCR-134#error, SCR-134#permission, SCR-134#stale, SCR-134#unsupported, SCR-134#missing, SCR-134#blocked | [Stage workspace](SCR-134.md) |
| SCR-135 | SCR-135#normal, SCR-135#loading, SCR-135#empty, SCR-135#error, SCR-135#permission, SCR-135#stale, SCR-135#queued, SCR-135#answered, SCR-135#proposal-unreflected, SCR-135#source-changed | [Item discussion](SCR-135.md) |
| SCR-136 | SCR-136#normal, SCR-136#loading, SCR-136#empty, SCR-136#error, SCR-136#permission, SCR-136#stale, SCR-136#passed, SCR-136#withdrawn, SCR-136#blocked | [Checkpoint review](SCR-136.md) |
| SCR-137 | SCR-137#normal, SCR-137#loading, SCR-137#empty, SCR-137#error, SCR-137#permission, SCR-137#stale, SCR-137#queued, SCR-137#retryable-failure, SCR-137#skipped | [Publication status](SCR-137.md) |
| SCR-138 | SCR-138#normal, SCR-138#loading, SCR-138#empty, SCR-138#error, SCR-138#permission, SCR-138#stale, SCR-138#issued, SCR-138#secret-unavailable, SCR-138#revoked | [Publication credentials](SCR-138.md) |
| SCR-139 | SCR-139#normal, SCR-139#loading, SCR-139#empty, SCR-139#error, SCR-139#permission, SCR-139#stale, SCR-139#outdated, SCR-139#withdrawn | [Version history](SCR-139.md) |
| SCR-140 | SCR-140#normal, SCR-140#loading, SCR-140#empty, SCR-140#error, SCR-140#permission, SCR-140#stale, SCR-140#sample-readonly | [Sample guide](SCR-140.md) |
| SCR-141 | SCR-141#normal, SCR-141#loading, SCR-141#empty, SCR-141#error, SCR-141#permission, SCR-141#stale, SCR-141#refused, SCR-141#unsupported | [Isolated mockup preview](SCR-141.md) |

- [SCR-131 Welcome](SCR-131.md): normal, loading, empty, error, permission, stale, auth-pending, expired
- [SCR-132 Projects](SCR-132.md): normal, loading, empty, error, permission, stale
- [SCR-133 Connect project](SCR-133.md): normal, loading, empty, error, permission, stale, consent-required, connected
- [SCR-134 Stage workspace](SCR-134.md): normal, loading, empty, error, permission, stale, unsupported, missing, blocked
- [SCR-135 Item discussion](SCR-135.md): normal, loading, empty, error, permission, stale, queued, answered, proposal-unreflected, source-changed
- [SCR-136 Checkpoint review](SCR-136.md): normal, loading, empty, error, permission, stale, passed, withdrawn, blocked
- [SCR-137 Publication status](SCR-137.md): normal, loading, empty, error, permission, stale, queued, retryable-failure, skipped
- [SCR-138 Publication credentials](SCR-138.md): normal, loading, empty, error, permission, stale, issued, secret-unavailable, revoked
- [SCR-139 Version history](SCR-139.md): normal, loading, empty, error, permission, stale, outdated, withdrawn
- [SCR-140 Sample guide](SCR-140.md): normal, loading, empty, error, permission, stale, sample-readonly
- [SCR-141 Isolated mockup preview](SCR-141.md): normal, loading, empty, error, permission, stale, refused, unsupported

## Shared rules

Map common API failures on each screen. A mutation becomes successful only after durable acknowledgement. External agents call API-214–API-217, API-219 and API-235–API-236 directly; the browser receives no lease token. Operator migration API-237–API-240 and compatibility API-241 have no public screen. Publication API-225 is invoked by CLI/CI; the screen reads its receipt.

[All wireframes](wireframes.html)

Access, input, missing targets, state changes, repeats, concurrency, limits, outside services, exposure, empty data and AI responses map to the named states and shared rules. HTML structure is generated here; real mockup contrast, keyboard and responsive measurements are recorded in stage 09. Real API/authentication/migration verification remains stage 11/12 work.

Only the owner browser session accepts or rejects proposals through API-218. Structural wireframes show each screen’s actual input, discussion, decision and recovery regions instead of shared placeholders; check reproducibility with `python tools/rebuild_wireframes.py --check`. They do not claim to be working product screens.
