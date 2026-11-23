// The thirteen CORTHEX stages (components.schemas.Stage of api/openapi.yaml) in their order, each with the number and
// the Korean name its stage tab shows, as the stage-09 mockup writes them.

export const STAGES = Object.freeze([
  ['01-domain', '도메인'],
  ['02-prd', 'PRD'],
  ['03-user-flow', '사용자 흐름'],
  ['04-functional-spec', '기능 명세'],
  ['05-erd', 'ERD'],
  ['06-api', 'API'],
  ['07-sitemap', '사이트맵'],
  ['08-screen-states', '화면 상태'],
  ['09-mockup', '목업'],
  ['10-wbs', 'WBS'],
  ['11-development', '개발'],
  ['12-qa', 'QA'],
  ['13-presentation', '발표'],
].map(([id, name]) => Object.freeze({ id, number: id.slice(0, 2), name })));

// The stage of an ID, or undefined.
export function stageOf(id) {
  return STAGES.find((stage) => stage.id === id);
}
