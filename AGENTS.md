# Working on NEXUS

NEXUS v3 is rebuilt from stage 01 in this repository, starting on 2026-11-22. v2 is archived at the tag `archive/nexus-v2-2026-11-22`, and the branch `legacy/v2` serves the running production instance until v3 replaces it. These rules hold for v3.

## A public repository

- This repository is public. Never put in Git secrets, credentials, tokens, private keys, database files, backups or logs; private records; personal names, email addresses or home paths; or server coordinates such as real addresses, SSH names, users, ports and paths, Tunnel IDs or Access team and AUD values. Examples use placeholders.
- Refer to the person who owns the project as "the maintainer". Decisions with their exact words, private records and private links stay in the project's records outside Git.
- Never copy keys or authentication files between devices.

## Sources and documents

- English is the source. Every README and every document under `docs/` has a matching Korean copy beside it, `NAME.md` and `NAME.ko.md`, changed in the same pull request.
- `.corthex/project.json` declares the project for the hub in the `corthex` skill's project-file format, with one part, `nexus`, and each stage's source. The stage sources are the truth: change the source first, and the human views and records follow. `.corthex/stages/nexus.json` records the part's stage progress; record a checkpoint only after the maintainer passes it, with its date and where it was given.
- The hub plugin and the core skills stay in `kodonghui/corthex`. `hub-ref.json` pins their exact commit, and `.github/workflows/corthex-nexus-push.yml` runs the hub at the same commit. Change both in one pull request after checking this repository against the new hub; never follow a branch tip.
- Ask before adding a runtime dependency or a build or development dependency.

## Pull requests

- Work through pull requests to `main`. `main` is protected and requires the `all-checks` status. `legacy/v2` takes only fixes to the running instance.
- Every pull request gets a Claude review: `/code-review`, plus `/security-review` when the change touches security, such as access, secrets, untrusted input, the network or the push job. Leave the findings and the outcome of each as a PR comment.
- Just before merge, request a single Codex review with the PR comment `@codex review`. If it fails on a usage limit, decide on the Claude review and note the failure in the PR.
- Write the Codex mention, the at-sign followed by `codex`, only in the one comment that requests the review. Everywhere else, such as PR descriptions, commit messages and other comments, write "Codex review" without the at-sign, because the Codex connector reads any mention as a request for a task.

## Checks

Use Python 3.12 or later, Git and Bash. Prepare a clean checkout of the exact hub pin outside this checkout and set `CORTHEX_HUB_CHECKOUT` to it; the tests fetch nothing. Run before every commit:

```sh
python tools/fetch_hub_ref.py --destination <path-outside-this-checkout>
python -m unittest discover -s tests -v
python tools/public_history_check.py HEAD
```

The tests check the hub pin, the public-safety rules on the tree, and the pinned hub reading `.corthex/` and running the push job's lines on this tree without a server. `.github/workflows/check.yml` runs them, the history check and Gitleaks over the whole history, and reports `all-checks`. When v3 code arrives, add its tests and build to that workflow and to this list. No test uses real credentials or a paid API.
