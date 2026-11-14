// The pictures' colours as the editors draw them: a stroke and a fill for each kind of a
// picture's box. The picture view's first SVG (../preview.js) and the first page's small
// views (./home.js) draw with them. In the dark theme a small view passes through the
// editors' own dark filter (page.css), which turns this palette into the dark one that
// stage 09's redesign.html draws, so that the palette has no second copy.
export const PALETTE=Object.freeze({context:["#64748b","none"],lane:["#64748b","none"],event:["#9a3412","#ffedd5"],command:["#1e40af","#dbeafe"],actor:["#854d0e","#fef9c3"],aggregate:["#854d0e","#fef08a"],"read-model":["#166534","#dcfce7"],policy:["#6b21a8","#f3e8ff"],external:["#86198f","#fae8ff"],hotspot:["#991b1b","#fee2e2"],screen:["#334155","#e2e8f0"],table:["#334155","#e2e8f0"]});
// The editors' dark filter, which the dark ground of the pictures (color.picture-ground,
// #121212) is white through: invert(93%) hue-rotate(180deg).
export const DARK_FILTER="invert(93%) hue-rotate(180deg)";
