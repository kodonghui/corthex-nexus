# Rebuild API contract and compatibility

[한국어](rebuild.ko.md)

Status: 36 HTTP operations in the [OpenAPI 3.1 contract](sources/rebuild/openapi.json), plus five [operator interfaces](sources/rebuild/operator.md). These are design artifacts, not implementation or deployment evidence.

| Operation | HTTP | Behaviors |
| --- | --- | --- |
| API-201 getOwnerSession | GET /api/v2/session | SPEC-301, SPEC-332, SPEC-333 |
| API-202 startOwnerSignIn | POST /api/v2/auth/start | SPEC-333 |
| API-203 completeOwnerSignIn | GET /api/v2/auth/callback | SPEC-333 |
| API-204 signOut | POST /api/v2/session/logout | SPEC-333 |
| API-205 listOwnerProjects | GET /api/v2/projects | SPEC-301, SPEC-302, SPEC-332 |
| API-206 connectProject | POST /api/v2/projects | SPEC-326, SPEC-333, SPEC-350 |
| API-207 getProjectOverview | GET /api/v2/projects/{projectId} | SPEC-302, SPEC-303, SPEC-304, SPEC-320, SPEC-332, SPEC-337 |
| API-208 getStageArtifact | GET /api/v2/projects/{projectId}/stages/{part}/{stage} | SPEC-304, SPEC-305, SPEC-306, SPEC-307, SPEC-308, SPEC-337 |
| API-209 getArtifactItem | GET /api/v2/projects/{projectId}/stages/{part}/{stage}/items/{itemId} | SPEC-308, SPEC-309, SPEC-310, SPEC-341 |
| API-210 listStageDiscussions | GET /api/v2/projects/{projectId}/stages/{part}/{stage}/discussions | SPEC-311, SPEC-313, SPEC-342 |
| API-211 askAboutArtifact | POST /api/v2/projects/{projectId}/stages/{part}/{stage}/discussions | SPEC-311, SPEC-312, SPEC-337 |
| API-212 getDiscussion | GET /api/v2/projects/{projectId}/discussions/{discussionId} | SPEC-311, SPEC-313, SPEC-314, SPEC-342 |
| API-213 recordDiscussionDecision | POST /api/v2/projects/{projectId}/discussions/{discussionId}/decisions | SPEC-314, SPEC-316 |
| API-214 listAgentWork | GET /api/v2/projects/{projectId}/agent/work | SPEC-312, SPEC-315 |
| API-215 claimAgentWork | POST /api/v2/projects/{projectId}/agent/work/{workId}/claim | SPEC-315 |
| API-216 replyToAgentWork | POST /api/v2/projects/{projectId}/agent/work/{workId}/reply | SPEC-313, SPEC-315 |
| API-217 proposeArtifactChange | POST /api/v2/projects/{projectId}/discussions/{discussionId}/proposals | SPEC-316 |
| API-218 decideProposal | POST /api/v2/projects/{projectId}/proposals/{proposalId}/decision | SPEC-314, SPEC-316 |
| API-219 recordProposalReflection | POST /api/v2/projects/{projectId}/proposals/{proposalId}/reflection | SPEC-314, SPEC-316 |
| API-220 requestCheckpoint | POST /api/v2/projects/{projectId}/checkpoints | SPEC-317, SPEC-320, SPEC-321, SPEC-322, SPEC-324 |
| API-221 getCheckpointReview | GET /api/v2/projects/{projectId}/checkpoints/{checkpointId} | SPEC-317, SPEC-318, SPEC-320, SPEC-321, SPEC-343 |
| API-222 decideCheckpoint | POST /api/v2/projects/{projectId}/checkpoints/{checkpointId}/decisions | SPEC-318, SPEC-319, SPEC-320 |
| API-223 withdrawCheckpoint | POST /api/v2/projects/{projectId}/checkpoints/{checkpointId}/withdrawals | SPEC-319, SPEC-321, SPEC-323 |
| API-224 listProjectVersions | GET /api/v2/projects/{projectId}/versions | SPEC-321, SPEC-322, SPEC-324 |
| API-225 publishSnapshot | POST /api/v2/projects/{projectId}/publications | SPEC-325, SPEC-326, SPEC-327, SPEC-328, SPEC-329 |
| API-226 getPublicationReceipt | GET /api/v2/projects/{projectId}/publications/{publicationId} | SPEC-327, SPEC-328, SPEC-329 |
| API-227 consentFirstPublication | POST /api/v2/projects/{projectId}/publication-consents | SPEC-326 |
| API-228 listProjectCredentials | GET /api/v2/projects/{projectId}/credentials | SPEC-332, SPEC-333 |
| API-229 issueProjectCredential | POST /api/v2/projects/{projectId}/credentials | SPEC-319, SPEC-332, SPEC-333 |
| API-230 revokeProjectCredential | POST /api/v2/projects/{projectId}/credentials/{credentialId}/revoke | SPEC-332, SPEC-333 |
| API-231 getIsolatedPreview | GET /api/v2/projects/{projectId}/previews/{artifactId} | SPEC-307, SPEC-308, SPEC-337 |
| API-232 getPublicSample | GET /api/v2/sample | SPEC-348, SPEC-350 |
| API-233 createPrivateSampleProject | POST /api/v2/sample-projects | SPEC-348, SPEC-350 |
| API-234 pollProjectEvents | GET /api/v2/projects/{projectId}/events | SPEC-303, SPEC-312, SPEC-313, SPEC-315, SPEC-337 |
| API-235 renewAgentClaim | POST /api/v2/projects/{projectId}/agent/work/{workId}/renew | SPEC-315 |
| API-236 releaseAgentClaim | POST /api/v2/projects/{projectId}/agent/work/{workId}/release | SPEC-315 |

## Contract decisions

1. Use 400 for invalid input, 404 for absent/foreign private objects, 403 for an authenticated role attempting a forbidden operation, and 409 for stale content/revision, invalid state, conflicting idempotency or lease/ancestry conflicts. An empty collection is 200 with []; success is durable, not an optimistic UI state. 429 carries Retry-After. All error bodies use RFC 9457 application/problem+json with safe code and traceId; routing 404/405 and payload failures use the same boundary shape (405 also retains Allow).
2. Human-only checkpoint/proposal decisions use the opaque owner session with origin and CSRF checks. Machines use separate project-scoped bearer credentials and cannot fall back to a browser identity. Foreign project lookup is indistinguishable from absent content. Cookies, credential digests, provider tokens, raw diagnostics and another owner's data never appear in view schemas.
3. Mutation Idempotency-Key is scoped by owner/project/operation and retained for at least 24 hours. Same body replays one durable result; another body returns idempotency_conflict. One-time credential secrets are explicitly excluded from stored receipts: the 200 replay returns public metadata and secret_not_replayed. Recovery is revoke/reissue, never plaintext storage. This is the only one-time private response exception.
4. Owner decisions carry expected_revision and content_version in the body; a transactional compare refuses an outdated view. A reply instead keeps the question's original content version even if a new artifact appeared. Discussion reads expose sanitized agent-work state without lease tokens. Diagram reads return source-derived nodes/edges and property lists. A stable item key may append a deterministic child key to its trace ID (at most 80 characters in total), so a command/event/flow step can have its own discussion without renumbering the parent trace ID. A live ten-minute agent lease is renewed explicitly; expired lease writes are refused and queued work can be reclaimed. The first release polls cursors and has no AI streaming protocol or in-process provider call.
5. Public signup uses a configurable OIDC adapter, authorization code and PKCE. Verify state/nonce once and issuer/audience/signature, protect the code exchange and rotate the owner session. Idle timeout is 30 minutes, absolute lifetime 8 hours. Provider registration is an external implementation prerequisite, not completed setup. Redirects use only a validated same-origin return path; sign-in failures never log tokens/code/state.
6. The version envelope is RFC 8785 canonical JSON: version=nexus.content/1, parser_contract, source_files sorted by normalized relative path with raw UTF-8 SHA-256, and attachment digests sorted by path. content_version is SHA-256 of that envelope. Source commit/publication time and device-only theme/folds/selection/layout are provenance or display metadata outside the envelope. Unknown source or parser/relationship/schema/attachment changes invalidate conservatively. This does not strip arbitrary fields out of raw reviewed sources to preserve an approval.
7. New v2 publication verifies GitHub default-branch ancestry through a read-only repository connection. Private repository connection authorization and provider configuration are external prerequisites; missing access returns source_verification_unavailable, not a false verification. Restrict host/API paths to configured GitHub; never fetch arbitrary supplied URLs. Existing legacy upload routes keep the existing hub wire format and Access authentication adapter until the replacement has passed compatibility QA. A new hub v2 transport requires a linked upstream/product change and contract tests; this design does not silently repin hub-ref.json.
8. Preview HTML is fetched through owner authorization and rendered in an opaque sandbox, with no ambient cookie authority, same-origin capability, network, form submission, navigation, popup, storage or trusted parent message. Self-contained HTML is supported; external assets stay blocked. Synthetic preview fixtures must attempt malicious links/scripts, credential access and writes before release.
9. Every HTTP operation explicitly defines security and successful/error examples and accounts for omitted standard responses. Field lengths, aggregate limits and safe refusal messages are contract inputs to the mock UI and later real-server tests. The contract is validated statically and its examples against schemas now; a mock response does not prove actual runtime authorization or persistence.

## Breaking-change and compatibility inventory

The v2 routes, owner sessions, scoped credentials and source envelope are new contracts, not an in-place reinterpretation of the old snapshot or Access client ID/secret. The legacy OpenAPI and original interface text remain byte-identical. The JSON registration preserves the historical interface IDs, titles, status and trace links, pointing back to the original source. Keep old API behavior available behind its existing protection while the new service is tested; bind existing projects to the verified owner during migration, never make them publicly readable. Existing comments/checkpoints retain original IDs and version bindings. Old clients are supported by the compatibility adapter; switching them to v2 is explicit WBS work with upstream tests. No runtime dependency or paid provider is added in this design phase.

## Verification and later execution

Validate OpenAPI 3.1 and every named response example against its schema, including errors and the one-time credential replay. Confirm each server behavior maps to an operation or operator interface; client-only theme behavior has no network operation. Later implement a development mock from this contract, real service contract tests for every listed response and browser mappings from stage 08. Real provider authentication, real Git ancestry checks, real v2 uploads, abuse limits, migration and recovery are not claimed as passed here.

## Client discovery and version references

Work embeds the original question plus discussion/part/stage/item/version identifiers. An agent can resolve its cited source through API-208/API-209 under a scoped work check, then address API-212/API-217 without guessing. Discussion returns its revision, original scope and independently paginated proposal bodies/version/revisions; reflection evidence is distinct from acceptance. Publisher credentials cannot read discussions. Artifact/overview/history responses expose checkpoint IDs; artifacts expose the ID required by API-231, with nullable provenance/ID for a never-published missing artifact. Historical entries identify each part/stage/artifact within a publication. Checkpoint history retains the original actor and reason. The shared 405 response has a valid problem status/code and required Allow header. These additive design fields complete existing flows; no new HTTP operation or runtime implementation is claimed.

The revised contract validates 321 operation response examples plus the shared 405 refusal. Sixteen independent static discovery/in-memory DDL checks and all nine legacy external contract checks pass. Provenance and history also expose publication identity, server snapshot revision and publication time so the documented views can be implemented from their responses. This remains design evidence, not a real v2 service test.
