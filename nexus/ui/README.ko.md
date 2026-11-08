# NEXUS 브라우저 빌드

[English](README.md)

그림 보기와 단계 현황은 08단계의 문구와 09단계의 확정된 토큰을 씁니다. 이 폴더의 브라우저 전용 의존성은 편집기 시험에서 허용된 예외인 Excalidraw 0.18.1, ERD Editor 5.1.0, React/React DOM 18.3.1입니다. 2026-11-08 다시 디자인의 확인 지점 3이 09단계의 IBM Plex Sans KR과 IBM Plex Mono를 위해 폰트 패키지 `@fontsource/ibm-plex-sans-kr`과 `@fontsource/ibm-plex-mono` 5.3.0을 더했습니다. Worker와 허브에는 실행 의존성이 없으며, 서버 패키지의 개발 의존성은 Wrangler 하나입니다.

## 다시 빌드하기

`../src/view-code/`에 커밋된 파일은 서버에서 npm 설치나 빌드 도구 없이 실행됩니다. 재현하는 순서입니다.

1. 이 폴더에서 확정된 lockfile로 `npm ci --ignore-scripts`를 실행합니다. 버전을 올리지 않습니다.
2. **저장소 밖 임시 폴더에 esbuild 0.28.2**를 `npm install --ignore-scripts --save-exact --prefix <scratch> esbuild@0.28.2`로 설치합니다. 저장소 의존성에 넣지 않습니다.
3. 저장소 루트에서 `node nexus/tools/build-ui.mjs --dependencies <브라우저-node_modules-절대경로> --tool <임시-node_modules/esbuild/lib/main.js-절대경로>`를 실행합니다.
4. `node nexus/tools/hub-style.mjs --write`로 같은 토큰을 기기의 허브에 넣고 Worker 사본을 맞춥니다.
5. AGENTS.md의 필수 검사를 실행합니다. UI 묶음을 인수하기 전에 브라우저 검사자가 실제 그림을 살피고 03단계 흐름을 걷습니다.

`sizes.json`은 최종 파일별 SHA256, 원본·gzip 크기, 경로를 정규화한 모듈 그래프와 입력 원본의 해시를 기록합니다. 주소에는 전체 그래프의 해시가 반영되므로 의존성이 바뀌면 그것을 가져오는 파일의 주소도 바뀝니다. JS/CSS는 Worker Text, WOFF2는 Data 모듈이며 Access를 검사하는 `/code/` 요청으로만 제공합니다. 정적 assets나 CDN은 쓰지 않습니다. 빌드가 모두 성공한 뒤 그 디렉터리의 오래된 생성 파일명만 지우며 디렉터리를 재귀 삭제하지 않습니다.

같은 버전으로 두 번 빌드하고 `sizes.json`과 `manifest.js`를 비교합니다. 브라우저 측정은 실제 배포와 정확한 묶음을 지정합니다. ready 표시만으로 그림이 읽힌다고 판단하지 않으며 시제품의 시간 측정은 완성 화면의 인수가 아닙니다.

## 다시 디자인의 페이지

다시 디자인의 페이지(TASK-272)는 0.2의 보기 옆에 자기 묶음을 따로 둡니다. `page.js`와 `page.css`이며, manifest는 이를 `page-js`, `page-css`, `page-preload`로 부릅니다. 서버와 페이지의 코드는 `../src/draw/`의 같은 모듈로 그립니다: 위 막대, 단계 상태의 모양과 말, 단계 목록, 탭을 09단계의 확정된 토큰과 08단계 `redesign-words.md`의 문구로 그리며, 그 문구는 `../tools/messages.mjs`가 0.2의 문구 옆에 `messages.js`로 엮습니다. 서버는 페이지마다 스타일시트를 안에 넣어 그려 보내므로, 코드가 끝내 오지 않아도 페이지를 읽을 수 있습니다([08단계 규칙 15](../../docs/08-screens/nexus/README.ko.md#다시-디자인의-화면)). 코드는 페이지의 자료로 같은 부분을 그리고, 다른 부분만 바꿉니다. 규칙 15의 막대는 코드가 6초 안에 시작하지 않으면 열리고, 코드가 실패하거나 스크립트가 꺼져 있으면 바로 열립니다. 페이지의 정책이 막는 인라인 스크립트는 쓰지 않습니다. 좁은 페이지가 보이는 것을 바꾸는 링크는 코드 없이도 동작합니다(규칙 16). `../test/draw.test.js`는 두 그림을 Node에서, `../test/page-regression.mjs`는 브라우저에서, 코드가 돌기 전과 뒤에 비교합니다.

## 수정과 라이선스

MIT 라이선스의 확정된 ERD Viewer에는 수정 두 가지가 있습니다. 이름을 자르지 않고 사각형에 맞추는 개요 글자 크기, 읽기 전용 이동·도형 위치와 화면 이동 이벤트입니다. 닫힌 shadow 내부에 접근하지 않습니다. 원본 해시와 수정 이름을 기록하며, 읽기 전용 화면의 배치를 저장하거나 스냅샷 계약에 더하지 않습니다.

Excalidraw 폰트와 선택적인 대체 폰트는 인증되는 같은 서버의 해시 주소를 씁니다. 오래된 선택적 Liberation 폰트 대신 OFL 1.1의 수정하지 않은 Liberation Sans 2.1.5를 외부 fontTools 4.60.2/brotli 1.1.0으로 WOFF2 변환하여 씁니다. `vendor/liberation-2.1.5.json`에 원본과 변환 파일의 해시를 적었습니다. 오래된 폰트는 배포하지 않습니다. `../NOTICE`에는 CORTHEX 원래 고지, 실제 묶인 패키지·폰트의 고지와 빌드의 법적 주석이 있습니다. `vendor/license-inventory.json`은 버전과 출처의 한계를 명시합니다.

IBM Plex Sans KR(굵기 400·500·600)과 IBM Plex Mono(400·500)는 OFL 1.1의 @fontsource 패키지에서 옵니다. 각 패키지의 유니코드 범위 조각을 수정하지 않고 인증되는 같은 서버의 해시 주소로 주며, 해시 이름의 스타일시트 하나(매니페스트의 `fonts-css`)가 WOFF 대체 없이 그 폰트들을 정의합니다. 보기 페이지는 이 연결을 비활성 템플릿에 두었다가 첫 화면을 그린 뒤에 켭니다. 편집기 자원과 같은 방식입니다. 그래서 첫 화면은 글꼴을 기다리지 않고, 조각이 도착하는 대로 글꼴이 바뀌며, 브라우저는 자기 페이지에 있는 글자의 조각만 한 번 받습니다. 거절 페이지는 시스템 폰트를 그대로 쓰고, 허브 페이지도 그 정책이 폰트를 허용하지 않아 아직 시스템 폰트를 씁니다.

고정한 Excalidraw 빌드의 원래 Firebase 호스팅 설정은 빈 객체로 바꿉니다. NEXUS의 읽기 전용 보기는 호스팅 협업을 사용하지 않습니다. 정확한 입력 해시와 `excalidraw-no-hosted-firebase` 변경은 `sizes.json`에 남기며, 배포 묶음 검사는 호스팅 Firebase 키가 남으면 실패합니다.

## 로컬 합성 브라우저 시험

저장소 루트에서 `node nexus/test/view-server.mjs`를 실행하면 loopback 주소를 출력합니다. 실제 handler/Store와 메모리 SQLite, 합성 Access를 쓰며 표준 입력이 닫히면 끝납니다. `--keep-open`은 관리되는 로컬 브라우저 시험에 씁니다. `qa-views`, `qa-views-reply`, `qa-views-overview`는 독립된 합성 프로젝트입니다. `/__qa/receipts`에서 시험용 쓰기 본문·ID를 확인합니다. `NEXUS_QA_PAGES=1`이면 제목에 마크업과 자료 표식을 지닌, 부분 두 개의 프로젝트 `qa-pages`도 다시 디자인의 페이지를 위해 심습니다. handler는 TASK-271부터 그 페이지를 제 주소 `/`, `/p/qa-pages`, `/p/qa-pages/{part}/{stage}`에서 냅니다. `?lang=ko`는 요청 하나에서 서버의 언어를 정합니다. 이 시험 서버는 배포하지 않으며 실제 계정이나 저장소 원문을 읽지 않습니다.

handler나 원본이 바뀌면 시험 서버를 다시 시작합니다. 브라우저 빌드만 바뀌면 재시작 없이 읽고, 열린 탭을 위해 이전 파일도 시험 서버 메모리에 남겨 둡니다. 마지막 브라우저 시험은 확정된 원본·빌드 해시를 적고 다시 시작한 서버에서 실행합니다.

저장소 분리 후 `hub-style.mjs --write`는 제품 사본만 고칩니다. 허브 양식 변경은 upstream PR과 정확한 hub-ref 갱신을 함께 검증하며 외부 기준점 폴더를 자동으로 고치지 않습니다.
