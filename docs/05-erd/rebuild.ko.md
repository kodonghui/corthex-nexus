# 재설계 데이터 모델과 이전 계약

[English](rebuild.md)

상태: 새 빈 데이터베이스용 설계입니다. 운영에 실행하지 않았습니다. [DDL](sources/rebuild.sql)과 [초기 마이그레이션](../../db/rebuild/migrations/001-initial.sql)은 동일합니다. 기존 SQL 등록 사본은 원본과 바이트 단위로 같으며 과거 승인과 새 설계를 분리합니다.

| Table | Context and terms | Behaviors |
| --- | --- | --- |
| TBL-126 owners | CTX-035, TERM-165 | SPEC-301, SPEC-332, SPEC-333 |
| TBL-127 owner_sessions | CTX-035, TERM-162 | SPEC-301, SPEC-318, SPEC-319, SPEC-323, SPEC-333 |
| TBL-128 projects | CTX-032, TERM-155 | SPEC-302, SPEC-303, SPEC-325, SPEC-326, SPEC-332, SPEC-341, SPEC-348, SPEC-350 |
| TBL-129 project_credentials | CTX-035, TERM-166 | SPEC-313, SPEC-315, SPEC-319, SPEC-331, SPEC-332, SPEC-333 |
| TBL-130 publications | CTX-032, TERM-156 | SPEC-304, SPEC-305, SPEC-306, SPEC-308, SPEC-325, SPEC-327, SPEC-328, SPEC-329, SPEC-341 |
| TBL-131 stage_artifacts | CTX-033, TERM-157, TERM-161 | SPEC-303, SPEC-304, SPEC-305, SPEC-306, SPEC-307, SPEC-308, SPEC-321, SPEC-322, SPEC-324 |
| TBL-132 artifact_items | CTX-033, TERM-158 | SPEC-305, SPEC-306, SPEC-308, SPEC-309, SPEC-310, SPEC-311, SPEC-341 |
| TBL-133 discussions | CTX-033, TERM-159 | SPEC-311, SPEC-312, SPEC-313, SPEC-314, SPEC-316, SPEC-342 |
| TBL-134 messages | CTX-033, TERM-159 | SPEC-311, SPEC-312, SPEC-313, SPEC-314, SPEC-342 |
| TBL-135 agent_work | CTX-033, TERM-167 | SPEC-312, SPEC-313, SPEC-315 |
| TBL-136 proposals | CTX-033, TERM-159 | SPEC-314, SPEC-316 |
| TBL-137 checkpoint_requests | CTX-034, TERM-160 | SPEC-317, SPEC-318, SPEC-319, SPEC-320, SPEC-321, SPEC-322, SPEC-324, SPEC-343 |
| TBL-138 checkpoint_decisions | CTX-034, TERM-160 | SPEC-318, SPEC-319, SPEC-321, SPEC-323, SPEC-343 |
| TBL-139 idempotency_receipts | CTX-032, TERM-163 | SPEC-311, SPEC-313, SPEC-318, SPEC-323, SPEC-327, SPEC-328, SPEC-329 |
| TBL-140 migration_runs | CTX-036, TERM-164, TERM-168 | SPEC-341, SPEC-342, SPEC-343, SPEC-344, SPEC-345 |
| TBL-141 legacy_mappings | CTX-036, TERM-164 | SPEC-341, SPEC-342, SPEC-343 |
| TBL-142 write_journal | CTX-036, TERM-164 | SPEC-311, SPEC-313, SPEC-318, SPEC-323, SPEC-344 |
| TBL-143 publication_consents | CTX-032, TERM-155 | SPEC-326, SPEC-350 |
| TBL-144 auth_attempts | CTX-035, TERM-162 | SPEC-333 |
| TBL-145 discussion_decisions | CTX-033, TERM-159 | SPEC-314, SPEC-316, SPEC-342 |

## 일관성과 데이터 경계

All project-scoped relationships use composite foreign keys, preventing a discussion, reply, publication or checkpoint from referencing another project's object. Project slug is unique per owner, not globally. Revisions, message order, consent and idempotency keys have explicit uniqueness. Deletions use RESTRICT: removal/retention is a later human-controlled operation. Checkpoint decision and message records are append-only in the application; import preserves original evidence rather than impersonating a fresh decision. Session/credential values are hashed; auth-attempt verifier and all backup/journal data remain protected server-only state and expire through explicit retention procedures.

Conditional transactions enforce properties SQL alone cannot prove: verified Git ancestry, owner session versus machine role, request content-version equality, dependency readiness, lease expiry and immutable decision history. Publication stores canonical source, attachment digests and parser version. The held pointer is changed in the same transaction as the publication and receipt. A durable acknowledgement is emitted only after the write, its safe receipt and recovery journal entry commit.

Read models TERM-170 through TERM-188 and preview TERM-169 are derived views, explicitly without their own tables. Theme and navigation preferences are per-device values, not private content stored in an account table. NEXUS makes no direct model-provider call; agent work and replies are persisted, but a fabricated provider telemetry table is unnecessary.

## 기존 데이터 매핑과 복구 계획

1. Inventory all retained collections and the actual runtime schema on the protected server. Current source names snapshots, project_spaces, pictures, discrepancies, comments, replies, decisions, proposals, edits, checkpoints, claims, writes and migrations; inspect actual migrations/extra tables before assuming this is complete.
2. Create a transactionally consistent backup and a protected manifest: schema version, counts by project/type, ID and parent/version reference sets, ordered content digests and write-journal boundary. Do not put the database or personal records in Git.
3. Assign the maintainer's existing collections to the verified owning account; preserve legacy names through legacy_mappings. Resolve every original snapshot revision and source version before importing items. Keep original comments/replies, actor/time/order, proposal state and checkpoint/withdrawal history. Unsupported historical records are retained in a protected compatibility archive with explicit mappings, never dropped.
4. Import into an isolated database using the initial migration, then validate foreign_key_check, counts, mapping uniqueness and protected content digests. Repush of a source snapshot is optional reconstruction of its artifact view and cannot replace server-only discussion/decision import.
5. Rehearse browser review and rollback on every retained project collection. Record exact counts, compatibility and elapsed restore time. None has been measured in this design phase.
6. At the authorized switch, pause writes briefly and copy the tail after the baseline boundary. Reconcile every acknowledged receipt before routing writes to the new service. Keep the old service/database protected and available for the prepared compatible rollback.
7. A failed post-switch check freezes writes, exports the new journal tail, restores compatible runtime and reconciles all acknowledged writes. A legacy runtime unable to represent a new record cannot simply be started on an old backup: use the compatibility replay or retain the new store and block completion until resolved. No irreversible deletion is part of this plan.

## 스키마 확인과 후속 작업

Validate the initial migration in an empty SQLite database, compare its sqlite_master tables/indexes with the canonical DDL, run foreign_key_check and exercise cross-project FK, duplicate idempotency and invalid-state refusals. These are schema design checks, not proof of a real legacy import or production restore. Stage 06 uses these column limits; stage 10 schedules application enforcement and protected migration/recovery evidence.

## 제안 저장 구조 수정

06 클라이언트 조회를 검토하며 제안 본문·작업 참조 저장이 누락된 것을 발견했습니다. TBL-136에 본문과 프로젝트별 작업 참조를 저장하고 TBL-135에 프로젝트/ID 고유 키를 추가했습니다. 새 요청은 claim 트랜잭션 안에서 작업의 원래 질문과 같은 대화인지도 확인합니다. 원래 콘텐츠 버전은 대화가 참조하는 고정 산출물에서 조회합니다. 기존 제안에 대응 작업이 없다면 work_id를 null로 유지해 에이전트 작업을 꾸미지 않으며 새 생성에는 실제 유효한 작업 ID가 필요합니다. 알 수 없거나 유효하지 않은 기존 기록은 보호된 가져오기 목록에 남겨 대조 전까지 배포를 막습니다. DDL·초기 마이그레이션은 동일하며 운영에는 실행하지 않았습니다.

TBL-145에 원래 본문·수행자·버전·원본/PR 참조를 가진 추가 전용 대화 결정을 저장합니다. 복합 외래 키는 검증한 근거를 해당 프로젝트의 게시본·커밋 한 쌍에 연결합니다. 새 쓰기는 근거가 필요하고 기존 기록은 검증한 것으로 꾸미지 않고 null 근거를 유지할 수 있습니다. 스키마는 이제 테이블 20개입니다.
