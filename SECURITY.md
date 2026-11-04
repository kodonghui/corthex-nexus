# Security

[한국어](SECURITY.ko.md)

The scope is one person on their own devices, with the server behind Cloudflare Access. Protect the authenticated origin, request boundaries, cross-site writes, untrusted source/comment/proposal text, repeated and concurrent writes, and backup/recovery. Account identities and credential values are never stored with entries or written to logs. Findings that require an attacker to have already changed the person's private local settings are recorded without blocking this iteration.

The product is under development. Report the commit, affected behavior and a minimal synthetic reproduction. Do not publish credentials, real project material or an unredacted database. Use GitHub private vulnerability reporting when available; otherwise request a private contact through an issue without posting exploit details or secrets. Ordinary bugs can use public issues with synthetic data.

Repository history is checked before import, secret scanning and push protection are enabled, and CI runs without real credentials. These checks do not replace access verification, input limits or actual recovery tests. Production switches and removal of rollback resources require the release decision.
