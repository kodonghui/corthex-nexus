# PR122 original16 hosted evidence

Run 41845045363, attempt 1: **96/96 exact named method executions ok**,
16 methods in each of six hub-compatibility cells. No method skip, ERROR or
FAIL was observed. Each result is inside the actual named hub verification
step running `python -m unittest discover -s tests -p "test_hub*.py" -v`.

| Hosted cell | Actual Python | Actual OS | Method results |
| --- | --- | --- | --- |
| hub-compatibility (macos-15-intel, 3.x) | 3.15.2 | macOS / 15.7.9 / 24G830 | 16 ok; 0 skip/error/fail |
| hub-compatibility (ubuntu-24.04, 3.8) | 3.8.18 | Ubuntu / 24.04.5 / LTS | 16 ok; 0 skip/error/fail |
| hub-compatibility (ubuntu-24.04, 3.x) | 3.15.2 | Ubuntu / 24.04.5 / LTS | 16 ok; 0 skip/error/fail |
| hub-compatibility (windows-latest, 3.8) | 3.8.10 | Microsoft Windows Server 2025 / 10.0.26100 / Datacenter | 16 ok; 0 skip/error/fail |
| hub-compatibility (macos-15-intel, 3.8) | 3.8.18 | macOS / 15.7.9 / 24G830 | 16 ok; 0 skip/error/fail |
| hub-compatibility (windows-latest, 3.x) | 3.15.2 | Microsoft Windows Server 2025 / 10.0.26100 / Datacenter | 16 ok; 0 skip/error/fail |

Local target evidence is separate: Windows Python 3.8.20 and 3.13.14.
Those local runs are not counted as hosted cells or substituted for a CI log.

PR head is c235a7a14220c229df53a29caf4c97d87c9261cf. Every job's checkout
log identifies the distinct synthetic merge 1aa71cd7aaa3e95698538136fb8ef7e86a988b2b.
GitHub-fetched merge blobs exactly equal the PR-head Git blobs for the new
test (payload SHA256 4fef0e9e2c0a47eaf00b202b4624927e600f25f1eba446b8440c9afdd28f6af8),
nine runtime sources, the fixture helper/child/pin and workflow: 14 files.
These are Git-blob byte comparisons, not a claim about native checkout line
endings. The runtime's accepted verification normalizes only CRLF to LF.

The nine runtime files match both the historical 3570 baseline and the current
product pin e7ff3947017703128df4c9e4e1b26b0d912eaa70, newly compared here.
Canonical hub.html is excluded from these nine files. Its separate product
Python10/E7 verification is parent-provided evidence and was not rerun here.

The JSON ledger keeps one row per case/method/cell with result, actual runner
and Python version, PR/merge commits and source/log SHA. It excludes personal
paths, credentials and session values. Raw decoded CI logs and their original
connector transport text are retained separately; their hashes are explicit.

No prior CI method result was reused. No workflow rerun, source/index/branch
change, commit, merge, Notion update, local browser or performance HTTP probe
was performed. These are synthetic isolated-home/loopback CLI assertions;
they do not prove real Access/user success or whole-product acceptance.

At this six-cell snapshot the overall workflow still had unrelated jobs
running. Whole-workflow completion/required-check state is a separate receipt;
the six successful cells alone do not authorize merge.
