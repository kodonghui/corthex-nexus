"""Rebuild the self-contained design HTML from DTCG tokens and screen definitions."""
from pathlib import Path
import json
import re
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def token_css(value, prefix=''):
    result = []
    for key, token in value.items():
        name = prefix + '-' + key if prefix else key
        if '$value' not in token:
            result.extend(token_css(token, name))
            continue
        item, kind = token['$value'], token['$type']
        if kind == 'color':
            item = '#' + ''.join('%02x' % round(c * 255) for c in item['components'])
        elif kind in ('dimension', 'duration'):
            item = str(item['value']) + item['unit']
        elif kind == 'fontFamily':
            item = ','.join(json.dumps(x) for x in item)
        elif kind == 'cubicBezier':
            item = 'cubic-bezier(' + ','.join(str(x) for x in item) + ')'
        result.append('--' + name + ':' + str(item) + ';')
    return result


def read(relative):
    return json.loads((HERE / relative).read_text(encoding='utf-8'))


def build():
    css = ':root{' + ''.join(token_css(read('base.tokens.json')) + token_css(read('theme/light.tokens.json'))) + '}\n'
    css += '[data-theme="dark"]{' + ''.join(token_css(read('theme/dark.tokens.json'))) + '}'
    template = (HERE / 'template.html').read_text(encoding='utf-8')
    for mode, selector in [('light', '[data-candidate=B]'), ('dark', '[data-candidate=B][data-theme=dark]')]:
        generated = selector + '{' + ''.join(token_css(read('candidates/B/theme/' + mode + '.tokens.json'))) + '}'
        template = re.sub(re.escape(selector) + r'\{[^}]+\}', lambda _: generated, template, count=1)
    definitions = json.loads((ROOT / 'docs/08-screens/sources/rebuild-states.json').read_text(encoding='utf-8'))
    return template.replace('/* TOKEN_CSS */', css).replace('/* DEFINITIONS */', json.dumps(definitions, ensure_ascii=False, separators=(',', ':')))


if __name__ == '__main__':
    output = build()
    target = HERE / 'index.html'
    if sys.argv[1:] == ['--check']:
        if target.read_text(encoding='utf-8') != output:
            raise SystemExit('Committed HTML differs from its tokens/template/screen definitions')
        print('Committed HTML matches its source inputs')
    elif sys.argv[1:]:
        raise SystemExit('Usage: python design/rebuild/render.py [--check]')
    else:
        target.write_text(output, encoding='utf-8')
        print('Rebuilt ' + str(target.relative_to(ROOT)))
