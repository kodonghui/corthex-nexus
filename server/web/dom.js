// Building the page. Every text goes in as text (textContent and attribute values), never as markup: the pages run
// under a Content-Security-Policy that refuses markup strings (Trusted Types) and inline styles, so nothing here parses
// HTML and no element gets a style attribute.

const SVG = 'http://www.w3.org/2000/svg';

// An element: h('a', { class: 'tab on', href, 'aria-current': 'page', on: { click } }, child, ...). A child is a
// node, a string (its text), or null and false, which are left out. An attribute whose value is null or false is left
// out; true sets it empty.
export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name === 'on') {
      for (const [event, handler] of Object.entries(value)) element.addEventListener(event, handler);
    } else if (value !== null && value !== false && value !== undefined) {
      element.setAttribute(name, value === true ? '' : String(value));
    }
  }
  element.append(...children.flat(Infinity).filter((child) => child !== null && child !== false && child !== undefined));
  return element;
}

// The header's icons, drawn as the mockup draws them.
const ICONS = Object.freeze({
  chevron: { size: 16, path: 'M4 6 L8 10 L12 6' },
  moon: { size: 20, path: 'M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z' },
});

export function icon(name, className = 'ic') {
  const { size, path } = ICONS[name];
  const svg = document.createElementNS(SVG, 'svg');
  for (const [attribute, value] of Object.entries({
    'aria-hidden': 'true', class: className, width: size, height: size, viewBox: `0 0 ${size} ${size}`,
  })) svg.setAttribute(attribute, String(value));
  const line = document.createElementNS(SVG, 'path');
  line.setAttribute('d', path);
  svg.append(line);
  return svg;
}

// Puts children in place of everything node holds.
export function fill(node, ...children) {
  node.replaceChildren(...children.flat(Infinity).filter((child) => child !== null && child !== false && child !== undefined));
  return node;
}
