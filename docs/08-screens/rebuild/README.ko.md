# 재설계 화면 상태

[English](README.md)

11개 화면의 모든 적용 상태와 호출하는 API 응답을 명시합니다. 실제 제품 구현·브라우저 전체 QA·사용자 검토 통과를 의미하지 않습니다.

## 화면 목록

| 화면 | 상태 | 정의 |
| --- | --- | --- |
| SCR-131 | SCR-131#normal, SCR-131#loading, SCR-131#empty, SCR-131#error, SCR-131#permission, SCR-131#stale, SCR-131#auth-pending, SCR-131#expired | [시작](SCR-131.ko.md) |
| SCR-132 | SCR-132#normal, SCR-132#loading, SCR-132#empty, SCR-132#error, SCR-132#permission, SCR-132#stale | [프로젝트](SCR-132.ko.md) |
| SCR-133 | SCR-133#normal, SCR-133#loading, SCR-133#empty, SCR-133#error, SCR-133#permission, SCR-133#stale, SCR-133#consent-required, SCR-133#connected | [프로젝트 연결](SCR-133.ko.md) |
| SCR-134 | SCR-134#normal, SCR-134#loading, SCR-134#empty, SCR-134#error, SCR-134#permission, SCR-134#stale, SCR-134#unsupported, SCR-134#missing, SCR-134#blocked | [단계 작업 화면](SCR-134.ko.md) |
| SCR-135 | SCR-135#normal, SCR-135#loading, SCR-135#empty, SCR-135#error, SCR-135#permission, SCR-135#stale, SCR-135#queued, SCR-135#answered, SCR-135#proposal-unreflected, SCR-135#source-changed | [항목 대화](SCR-135.ko.md) |
| SCR-136 | SCR-136#normal, SCR-136#loading, SCR-136#empty, SCR-136#error, SCR-136#permission, SCR-136#stale, SCR-136#passed, SCR-136#withdrawn, SCR-136#blocked | [체크포인트 검토](SCR-136.ko.md) |
| SCR-137 | SCR-137#normal, SCR-137#loading, SCR-137#empty, SCR-137#error, SCR-137#permission, SCR-137#stale, SCR-137#queued, SCR-137#retryable-failure, SCR-137#skipped | [게시 상태](SCR-137.ko.md) |
| SCR-138 | SCR-138#normal, SCR-138#loading, SCR-138#empty, SCR-138#error, SCR-138#permission, SCR-138#stale, SCR-138#issued, SCR-138#secret-unavailable, SCR-138#revoked | [게시·에이전트 권한](SCR-138.ko.md) |
| SCR-139 | SCR-139#normal, SCR-139#loading, SCR-139#empty, SCR-139#error, SCR-139#permission, SCR-139#stale, SCR-139#outdated, SCR-139#withdrawn | [버전 이력](SCR-139.ko.md) |
| SCR-140 | SCR-140#normal, SCR-140#loading, SCR-140#empty, SCR-140#error, SCR-140#permission, SCR-140#stale, SCR-140#sample-readonly | [샘플 가이드](SCR-140.ko.md) |
| SCR-141 | SCR-141#normal, SCR-141#loading, SCR-141#empty, SCR-141#error, SCR-141#permission, SCR-141#stale, SCR-141#refused, SCR-141#unsupported | [격리된 목업 미리보기](SCR-141.ko.md) |

- [SCR-131 시작](SCR-131.ko.md): normal, loading, empty, error, permission, stale, auth-pending, expired
- [SCR-132 프로젝트](SCR-132.ko.md): normal, loading, empty, error, permission, stale
- [SCR-133 프로젝트 연결](SCR-133.ko.md): normal, loading, empty, error, permission, stale, consent-required, connected
- [SCR-134 단계 작업 화면](SCR-134.ko.md): normal, loading, empty, error, permission, stale, unsupported, missing, blocked
- [SCR-135 항목 대화](SCR-135.ko.md): normal, loading, empty, error, permission, stale, queued, answered, proposal-unreflected, source-changed
- [SCR-136 체크포인트 검토](SCR-136.ko.md): normal, loading, empty, error, permission, stale, passed, withdrawn, blocked
- [SCR-137 게시 상태](SCR-137.ko.md): normal, loading, empty, error, permission, stale, queued, retryable-failure, skipped
- [SCR-138 게시·에이전트 권한](SCR-138.ko.md): normal, loading, empty, error, permission, stale, issued, secret-unavailable, revoked
- [SCR-139 버전 이력](SCR-139.ko.md): normal, loading, empty, error, permission, stale, outdated, withdrawn
- [SCR-140 샘플 가이드](SCR-140.ko.md): normal, loading, empty, error, permission, stale, sample-readonly
- [SCR-141 격리된 목업 미리보기](SCR-141.ko.md): normal, loading, empty, error, permission, stale, refused, unsupported

## 공통 규칙

공통 API의 오류도 각 화면에 매핑합니다. 변경 동작은 저장 확인 이후에만 성공으로 표시합니다. 사용 중인 외부 에이전트는 API-214~API-217·API-219·API-235·API-236을 직접 호출하며 브라우저에는 리스 토큰을 전달하지 않습니다. 운영자 마이그레이션 API-237~API-240과 호환성 API-241은 공개 화면을 갖지 않습니다. API-225 게시 실행은 CLI·CI가 담당하고 화면은 수신 결과만 조회합니다.

[전체 와이어프레임](wireframes.html)

개인 프로젝트 권한, 입력, 대상 누락, 상태 변경, 중복, 동시 처리, 제한, 외부 서비스, 정보 노출, 빈 응답과 AI 응답의 가시적 결과를 각 화면의 상태·응답·공통 규칙에 연결했습니다. 본 단계에서 HTML 구조를 생성했으며 실제 목업의 대비·키보드·반응형 측정은 09에서 기록합니다. 전체 실제 API·인증·이전 검증은 11·12의 작업입니다.

API-218의 제안 수락·거절은 소유자 브라우저 세션만 수행합니다. 구조 와이어프레임은 공통 자리 표시자 대신 각 화면의 실제 입력·대화·결정·복구 영역을 표시하며 `python tools/rebuild_wireframes.py --check`로 재현성을 검사합니다. 동작하는 제품 화면이라는 뜻은 아닙니다.
