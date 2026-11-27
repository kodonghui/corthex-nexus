// What an empty stage needs next (SPEC-054). These are explanations, not new writes or API data.
const MATERIAL = Object.freeze({
  '01-domain': '업무 흐름과 용어',
  '02-prd': '필요한 기능',
  '03-user-flow': '사용 순서',
  '04-functional-spec': '기능별 동작',
  '05-erd': '저장할 데이터와 관계',
  '06-api': '서로 주고받을 정보',
  '07-sitemap': '화면 목록과 연결',
  '08-screen-states': '화면마다 보일 상태',
  '09-mockup': '화면 시안',
  '10-wbs': '할 일과 작업 순서',
  '11-development': '개발 결과',
  '12-qa': '검사 결과',
  '13-presentation': '발표 자료',
});

export function emptyStageGuidance(stage) {
  const subject = MATERIAL[stage] ?? '이 단계에 필요한';
  return `지금 쓰는 AI 대화창에 “이 프로젝트의 ${subject} 내용을 정리해 NEXUS에 보내줘”라고 요청하세요.`;
}
