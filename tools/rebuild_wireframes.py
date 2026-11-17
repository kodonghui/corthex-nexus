"""Generate the structural rebuild gallery from the registered screen-state source."""
from pathlib import Path
import html
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'docs/08-screens/rebuild/wireframes.html'

def escape(value):
    return html.escape(str(value), quote=True)

def build():
    data = json.loads((ROOT / 'docs/08-screens/sources/rebuild-states.json').read_text())
    screens = data['screens'] if isinstance(data, dict) else data
    frames = []
    for screen in screens:
        for state in screen['states']:
            for width in (320, 1440):
                prefix = f"{screen['id']}-{state['id']}-{width}"
                def field(name, label, kind='text', value=''):
                    return f'<label for="{prefix}-{name}">{label}</label><input id="{prefix}-{name}" type="{kind}" value="{escape(value)}">'
                def button(label):
                    return '<button type="button">' + label + '</button>'
                def box(title, content):
                    return '<section class="box"><h3>' + title + '</h3>' + content + '</section>'
                controls = {
                    'SCR-131': box('Review a project, ask about an item, decide on its version', '<p>Private projects for individual owners. Public synthetic sample available before sign-in.</p>' + button('Sign in and start') + button('Explore the public sample')),
                    'SCR-132': field('search', 'Search projects') + button('Connect a project') + box('Synthetic NEXUS project', '<p>02 PRD · version 3 · awaiting review</p>' + button('Continue this project')) + box('Synthetic library project', '<p>03 User flow · last viewed item</p>' + button('Continue this project')),
                    'SCR-133': '<form onsubmit="return false">' + field('name', 'Project name', value='Synthetic project') + field('repository', 'GitHub repository URL', 'url', 'https://github.com/example/project') + box('First-publication preview', '<p>Review the source file list, commit, project and preview digest before consent. Credentials and environment values are excluded.</p><ul><li>02 PRD · docs/example.md · synthetic source</li></ul>' + button('Inspect source preview')) + '<label class="check"><input type="checkbox"> I consent to this exact first-publication preview</label>' + button('Connect project') + button('Cancel') + '</form>',
                    'SCR-134': '<div class="row">' + button('Diagram') + button('Keyboard list') + button('Source and version') + button('Review checkpoint') + '</div>' + box('Source-derived artifact region', '<div class="diagram">' + button('REQ-301 · Project list') + button('REQ-305 · Visual artifact') + button('REQ-318 · Human checkpoint') + '</div><p>Selected item: REQ-305 · version 3</p>') + box('Selected item inspector', '<p>Properties, source location and original content version.</p>' + button('Ask about this item')),
                    'SCR-135': box('Original discussion context', '<p>REQ-305 · 02 PRD · publication 3 · original version 3</p>' + button('Open original source')) + box('Conversation and recorded decisions', '<p>Owner question → queued agent work → answer/proposal.</p><p>Decisions retain body, actor and exact accepted source evidence.</p>') + '<label for="' + prefix + '-question">Question about this item</label><textarea id="' + prefix + '-question">Retained non-secret draft</textarea>' + button('Send question') + button('Record a decision') + box('Review a proposal', '<p>Proposal body and source diff. Acceptance does not mean reflection.</p>' + button('Accept proposal') + button('Reject proposal')),
                    'SCR-136': box('Reviewed content and prerequisites', '<p>Original version 3 compared with current version 3. Show unresolved questions, preceding stage and source evidence.</p>' + button('Open reviewed source')) + '<label for="' + prefix + '-reason">Decision reason</label><textarea id="' + prefix + '-reason"></textarea>' + button('Pass this version — confirmation required') + button('Ask before deciding') + box('Existing decision history', '<p>Retain original actor, reason and version.</p>' + button('Withdraw a previous pass — confirmation required')),
                    'SCR-137': box('Server publication receipt', '<dl><dt>Expected default commit</dt><dd>synthetic commit</dd><dt>Received publication</dt><dd>publication 3 · revision 3</dd><dt>Delivery</dt><dd>received / skipped / refused</dd><dt>Missing setup</dt><dd>List missing variable names only; never values</dd></dl>' + button('Refresh receipt') + button('Open credential setup') + button('Open version history')),
                    'SCR-138': field('role', 'Project credential role', value='publisher') + button('Issue project-scoped credential') + box('One-time credential', '<p>Only the newly issued response can show the secret. Later reads show metadata and loss/reissue guidance.</p>' + button('I saved it') + button('Revoke credential — confirmation required')) + box('Active credentials', '<p>Publisher · this project · created time · expiry · last use</p>' + button('Revoke selected credential')),
                    'SCR-139': ''.join(box('Publication ' + str(v), '<p>Original content version, commit, publication time and linked checkpoint decision.</p>' + button('Open version ' + str(v) + ' artifact') + button('Open version ' + str(v) + ' decision')) for v in (3, 2, 1)),
                    'SCR-140': box('Public synthetic guide', '<p>Step 1: inspect an artifact. Step 2: select an item and explore its discussion. Step 3: inspect a sample checkpoint.</p><p>No private project or write authority.</p>' + button('Explore the read-only sample') + button('Sign in to copy a private sample')),
                    'SCR-141': box('Opaque HTML preview region', '<div class="diagram"><p>Untrusted self-contained HTML. No parent authority, network, storage or navigation.</p></div>') + button('Reload isolated preview') + button('Open original source') + button('Return to artifact'),
                }
                body = controls[screen['id']]
                if state['id'] != 'normal':
                    action = 'Reload current version; require a new deliberate decision' if state['id'] == 'stale' else 'Retry / open source / return safely'
                    body = box('State: ' + escape(state['id']), '<p>' + escape(state['en']) + '</p>' + button(action)) + body
                public = screen['id'] in ('SCR-131', 'SCR-140')
                navigation = '' if public else '<nav aria-label="Project stages"><p>Private project selector</p><ol><li>01 Domain</li><li>02 PRD</li><li>03 User flow</li><li>…13 Presentation</li></ol></nav>'
                loading = ' inert aria-busy="true"' if state['id'] == 'loading' else ''
                frame = '<header>NEXUS · ' + ('Sign in · Public sample' if public else 'Project · Theme · Account') + '</header><div class="columns' + (' public' if public else '') + '">' + navigation + '<main' + loading + '><h2>' + escape(screen['name']) + '</h2><p>Source · Original version · Server state</p>' + body + '</main></div>'
                frames.append('<section id="' + prefix + '" data-state="' + screen['id'] + '#' + state['id'] + '" data-width="' + str(width) + '" class="sample"><h2>' + prefix + '</h2><div class="viewport"><div class="frame" style="width:' + str(width) + 'px">' + frame + '</div></div></section>')
    css = '*{box-sizing:border-box}body{margin:0;padding:24px;font:16px/1.6 system-ui,sans-serif;color:#222;background:#eee}h1,h2,h3{margin:0 0 16px}h2{font-size:20px}h3{font-size:17px}.sample{margin:32px 0}.viewport{max-width:100%;overflow:auto;border:1px solid #777}.frame{background:#fff;min-height:560px;padding:16px;container-type:inline-size}.frame header{border-bottom:1px solid #777;padding:12px;margin-bottom:16px}.columns{display:grid;grid-template-columns:180px minmax(0,1fr);gap:16px}.columns.public{grid-template-columns:minmax(0,1fr)}main{min-width:0}.box{border:1px solid #999;padding:16px;margin:16px 0}.diagram{overflow:auto;min-height:100px;border:1px dashed #777;padding:16px}button,input,textarea{font:inherit;max-width:100%;border:1px solid #555;padding:10px;color:#222;background:#eee}button{white-space:normal;overflow-wrap:anywhere;margin:4px 8px 4px 0;min-height:44px}input,textarea{display:block;width:100%;margin:8px 0 16px;background:#fff}textarea{min-height:90px}label{display:block}.check{display:flex;align-items:flex-start;gap:8px}.check input{width:auto;margin:8px}nav{padding:16px;background:#eee}p,dd{overflow-wrap:anywhere}dd{margin:0 0 12px}.index{display:flex;flex-wrap:wrap;gap:16px}@container(max-width:600px){.columns{display:block}.columns nav{margin-bottom:16px}}'
    index = ''.join('<a href="#' + s['id'] + '-normal-320">' + s['id'] + '</a>' for s in screens)
    return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rebuild state wireframes</title><style>' + css + '</style><h1>Rebuild screen-state wireframes</h1><p>Structural synthetic content only. Screen-specific controls and each named state at 320px and 1440px. Buttons do not call a service.</p><nav class="index">' + index + '</nav>' + '\n'.join(frames) + '</html>'

if __name__ == '__main__':
    output = build()
    if sys.argv[1:] == ['--check']:
        if TARGET.read_text() != output:
            raise SystemExit('Wireframes differ from their registered states/renderer')
        print('Wireframes match their source; 182 screen-specific frames')
    elif not sys.argv[1:]:
        TARGET.write_text(output)
        print('Rendered ' + str(TARGET.relative_to(ROOT)))
    else:
        raise SystemExit('Usage: python tools/rebuild_wireframes.py [--check]')
