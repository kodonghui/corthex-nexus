# 범위초과 그림의 새 브라우저 회귀

metadata `0d6a09de155e7c8d9b2bce00ba024d56853ed8d5a503e20f4c24b745e8d623a9` 하나로 검사했습니다. 실제 로컬 Node handler/Store/SQLite에 합성 Access와 새 합성 프로젝트를 사용했습니다. 운영·개발서버·실제계정에 요청하지 않았습니다. 이전612c/f088 자료는 동결 보존했고 이 결과와 섞지 않았습니다.

일반3종×EN/KO×320/1440×light/dark×preview/native48상태는 works이며 page-check error0/가로넘침0입니다. Ordinary300사이트맵의 초기HTML300노드와 native 전환도 별도 확인했습니다.

범위초과DDD는 snapshot171935B/source169656B,20lanes×200places×10반복=40000timeline occurrences이며 기존확장160021nodes에 해당하는 구조입니다. EN/KO×320/1440의4조합에서 GET/HEAD200·HEAD본문0B, 번역한계안내와원본항목6개,목록→패널이작동했습니다. native JS/CSS/font요청0,SVG/editor진입0,거짓ready0,가로넘침0입니다. 새댓글은실제POST정확히1회와GET내용으로확인했습니다. 원본API의40000timeline과SHA는그대로였습니다.

이큰그림의3000목록상한경계까지브라우저에서확인한것은아니며실제fallback목록6개를확인했습니다. Native canvas/ShadowDOM전체대비와정식P95/20회성능·전체기존QA통과는주장하지않습니다. Aside자체snapshot은성공했지만PNG는viewport screenshot timeout으로실패했고모든선택PNG는별도ChromeCDP로촬영했습니다.6장모두합성자료로육안검토했으며계정·인증값·프로필파일은포함하지않았습니다.
