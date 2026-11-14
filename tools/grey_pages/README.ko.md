# 회색 페이지의 스크립트

회색 와이어프레임 페이지 둘을 이 스크립트들이 이 체크아웃의 파일로 그립니다. Python 3.8 이상과 그 표준 라이브러리만 씁니다:

| 페이지 | 스크립트 | 그리는 것 |
| --- | --- | --- |
| [revision-wireframes.html](../../docs/08-screens/nexus/revision-wireframes.html) | [revision_wireframes.py](revision_wireframes.py) | 2026-11-11 설계 수정의 상태 행마다 08단계의 틀을 390과 1,440픽셀로, 정의서의 설계 수정 절에서 |
| [picture-stage-views.html](../../docs/09-mockup/nexus/picture-stage-views.html) | [picture_stage_views.py](picture_stage_views.py) | 그림 단계의 네 보기를 그린 09단계의 한 장, 1,280과 1,440픽셀 |

둘 다 틀의 말을 모두 08단계의 말 표, 곧 [revision-words.md](../../docs/08-screens/nexus/revision-words.ko.md), [redesign-words.md](../../docs/08-screens/nexus/redesign-words.ko.md), 그 [README](../../docs/08-screens/nexus/README.ko.md#메시지)의 표에서 한국어 꼴과 함께 가져오고, 틀이 어느 표에도 없는 말을 찾으면 오류로 멈춥니다. [wf_base.py](wf_base.py)는 말을 읽고 HTML의 작은 조각을 지니며, [wf_frames.py](wf_frames.py)는 틀의 부분을 그리고, [wf_css.py](wf_css.py)는 페이지의 스타일과 스크립트를 지닙니다.

## 페이지를 다시 그리기

페이지가 그리는 행이나 말을 바꾸는 변경은 같은 커밋에서 그 페이지를 다시 그립니다. 저장소의 뿌리에서:

```sh
python -W error tools/grey_pages/revision_wireframes.py
python -W error tools/grey_pages/picture_stage_views.py
```

저마다 제 페이지를 그 자리에 쓰고, 그린 틀과 말의 수를 알리며, 두 말 표가 달리 옮긴 말을 하나씩 적습니다. 그런 말은 틀이 첫 표의 꼴로 그립니다. `--out FILE`은 다른 곳에 씁니다. [tests/test_grey_pages.py](../../tests/test_grey_pages.py)가 두 페이지를 그려 커밋한 파일과 바이트까지 대조하므로, 손으로 고친 페이지나 페이지가 따르지 않은 변경은 이 시험에 걸립니다.

## 페이지를 재기

[measure.mjs](measure.mjs)가 브라우저에서 페이지를 잽니다. 맡은 쪽이 페이지를 다시 그린 뒤 Node 24와 자기가 가진 Chrome으로 손으로 돌리며, 저장소의 어느 시험도 의존성도 이것을 적지 않습니다. `nexus/test`의 브라우저 회귀 시험처럼 따로 띄운 headless Chrome을 DevTools 프로토콜로 다루고, 페이지를 로컬 파일로 읽으며 네트워크에 닿지 않습니다:

```sh
NEXUS_CHROME=/absolute/path/to/chrome node tools/grey_pages/measure.mjs
```

페이지를 적지 않으면 두 페이지를 잽니다. 페이지마다:

- 320, 390, 1,280, 1,440픽셀 폭에서 밝은·어두운 모드와 영어·한국어로 16번 돌려: 페이지가 옆으로 스크롤되지 않고, 고른 언어를 보이며, 콘솔에 오류가 없음.
- 틀마다 제 크기로, 영어와 한국어로: 어떤 요소도 틀 밖으로 옆으로 나가거나 틀의 열에 잘리지 않음(그림의 캔버스는 빼는데, 보기보다 큰 그림처럼 담은 것을 자르기 때문임). 그리고 어떤 말도 제 단추, 꼬리표, 탭보다 넓지 않음.

문제마다 그 틀과 함께 적고 수를 찍으며, 문제를 찾으면 1로 끝납니다. 2026-11-12, TASK-285에서 headless Chromium으로: revision-wireframes.html은 16번 돌리고 틀을 128번 재고, picture-stage-views.html은 16번 돌리고 32번 재어 문제가 없었습니다. 옆으로 스크롤되는 페이지, 콘솔 오류, 제 말보다 좁은 단추, 열에 잘린 글은 저마다 찾아졌습니다. 틀을 눈으로 보는 일은 사람의 단계로 남습니다: 재기는 넘치는 것을 찾을 뿐, 읽기 나쁜 것을 찾지는 않습니다.
