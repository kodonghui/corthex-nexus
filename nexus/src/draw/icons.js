// The redesign's icons and the shapes of the stages' states, as stage 09's
// redesign.html draws them: SVG, since the two fonts lack some shapes (BUG-596).
// The page holds them once, and each use refers to its symbol.
export const SYMBOLS=Object.freeze({
 "i-search":"<circle cx=\"7\" cy=\"7\" r=\"4.5\"/><path d=\"M10.4 10.4 14 14\"/>",
 "i-close":"<path d=\"M4 4l8 8M12 4l-8 8\"/>",
 "i-back":"<path d=\"M10 3 5 8l5 5\"/>",
 "i-down":"<path d=\"M4 6l4 4 4-4\"/>",
 "i-next":"<path d=\"M6 3l5 5-5 5\"/>",
 "i-menu":"<path d=\"M2.5 4h11M2.5 8h11M2.5 12h11\"/>",
 "i-plus":"<path d=\"M8 3v10M3 8h10\"/>",
 "i-minus":"<path d=\"M3 8h10\"/>",
 "i-fit":"<path d=\"M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10\"/>",
 "i-goto":"<circle cx=\"8\" cy=\"8\" r=\"5\"/><path d=\"M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3\"/>",
 "i-map":"<rect x=\"2\" y=\"3\" width=\"12\" height=\"10\" rx=\"1\"/><rect x=\"5\" y=\"6\" width=\"5\" height=\"4\"/>",
 "i-ext":"<path d=\"M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5v4H2.5V4h4\"/>",
 "i-check":"<path d=\"M3 8.5 6.5 12 13 4.5\"/>",
 "i-warn":"<path d=\"M8 2 14.5 13.5h-13z\"/><path d=\"M8 6.5v3.2\"/><path d=\"M8 11.6v.1\"/>",
 "i-err":"<circle cx=\"8\" cy=\"8\" r=\"6\"/><path d=\"M8 4.8v3.6\"/><path d=\"M8 11v.1\"/>",
 "i-info":"<circle cx=\"8\" cy=\"8\" r=\"6\"/><path d=\"M8 7.2v3.8\"/><path d=\"M8 4.9v.1\"/>",
 "i-lock":"<rect x=\"3\" y=\"7\" width=\"10\" height=\"7\" rx=\"1\"/><path d=\"M5.5 7V5a2.5 2.5 0 0 1 5 0v2\"/>",
 "i-reload":"<path d=\"M13 8a5 5 0 1 1-1.6-3.7\"/><path d=\"M13 2.5v3h-3\"/>",
 "i-pic":"<path d=\"M8 2.2 13.8 8 8 13.8 2.2 8z\"/>",
 "i-talk":"<path d=\"M2.5 3.5h11v7.5H7l-3 2.5V11H2.5z\"/>",
 "i-edit":"<path d=\"M10.5 2.5l3 3-8 8h-3v-3z\"/>",
 "i-record":"<rect x=\"3.5\" y=\"2.5\" width=\"9\" height=\"11.5\" rx=\"1\"/><path d=\"M6 6h4M6 8.5h4M6 11h2.5\"/>",
 "i-group":"<path d=\"M2.5 4h11M5 8h8.5M5 12h8.5\"/>",
 "i-list":"<path d=\"M5.5 4h8M5.5 8h8M5.5 12h8\"/><path d=\"M2.5 4h.1M2.5 8h.1M2.5 12h.1\"/>",
 "i-picture":"<rect x=\"2\" y=\"2.5\" width=\"12\" height=\"11\" rx=\"1\"/><path d=\"M4.5 6h3v2h-3zM9 9h3v2H9z\"/><path d=\"M7.5 7h3v2\"/>",
 "i-reply":"<path d=\"M6.5 4 2.5 8l4 4\"/><path d=\"M2.5 8h7a4 4 0 0 1 4 4v1\"/>",
 "i-dot":"<circle cx=\"8\" cy=\"8\" r=\"2.5\"/>",
 "s-done":"<circle class=\"c-done-bg\" cx=\"8\" cy=\"8\" r=\"7\"/><path class=\"c-done-fg\" d=\"M4.8 8.2 7 10.4l4.2-4.6\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
 "s-prog":"<circle class=\"c-prog\" cx=\"8\" cy=\"8\" r=\"6.2\" stroke-width=\"1.6\"/><path class=\"c-prog-f\" d=\"M8 1.8a6.2 6.2 0 0 0 0 12.4z\"/>",
 "s-todo":"<circle class=\"c-todo\" cx=\"8\" cy=\"8\" r=\"6.2\" stroke-width=\"1.6\"/>",
 "s-skip":"<circle class=\"c-todo\" cx=\"8\" cy=\"8\" r=\"6.2\" stroke-width=\"1.6\"/><path class=\"c-skip\" d=\"M5 8h6\" stroke-width=\"1.8\" stroke-linecap=\"round\"/>",
 "s-unk":"<circle class=\"c-unk\" cx=\"8\" cy=\"8\" r=\"6.2\" stroke-width=\"1.6\" stroke-dasharray=\"2.4 2\"/><path class=\"c-unk-q\" d=\"M6.3 6.4a1.8 1.8 0 1 1 2.5 1.7c-.5.2-.8.6-.8 1.1v.4\" stroke-width=\"1.5\" stroke-linecap=\"round\"/><circle class=\"c-unk-d\" cx=\"8\" cy=\"11.5\" r=\".9\"/>"
});
export const SPRITE=`<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false"><defs>${Object.entries(SYMBOLS).map(([id,body])=>`<symbol id="${id}" viewBox="0 0 16 16">${body}</symbol>`).join("")}</defs></svg>`;
// A stage's state is a shape and a word (stage 08's rule 13): never colour alone.
export const SHAPES=Object.freeze({done:"s-done",in_progress:"s-prog",not_started:"s-todo",skipped:"s-skip",unknown:"s-unk"});
export const icon=(name,extra="")=>{if(!Object.hasOwn(SYMBOLS,name)||!name.startsWith("i-"))throw new Error("No such icon: "+name);return`<svg class="i${extra?" "+extra:""}" aria-hidden="true" focusable="false"><use href="#${name}"/></svg>`;};
export const shapeIcon=state=>`<svg class="st" aria-hidden="true" focusable="false"><use href="#${SHAPES[state]||SHAPES.unknown}"/></svg>`;
