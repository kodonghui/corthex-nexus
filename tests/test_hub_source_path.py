"""TC-221: the 0.6.0 pinned hub against a throwaway v3 server and synthetic multi-file sources."""
import json
import urllib.error
import urllib.request
from test_hub_run import HubRunFixture, PROJECT

class SourcePathWalk(HubRunFixture):
    def test_source_paths(self):
        settings = self.project / '.corthex/project.json'
        obj = json.loads(settings.read_text(encoding='utf8'))
        obj['stages']['05-erd']['source'] = 'db/'
        obj['stages']['07-sitemap']['source'] = 'docs/07-sitemap/'
        settings.write_text(json.dumps(obj), encoding='utf8')
        cases = [
            ('01-domain', 'CTX-901', 'docs/01-domain/nexus-left.md', '### CTX-901 Ordering\n', '### CTX-901 Buying\n', 'docs/01-domain/nexus-other.md'),
            ('05-erd', 'TBL-901', 'db/nexus-left.sql', '-- TBL-901 alpha\nCREATE TABLE qa_alpha (id INTEGER PRIMARY KEY);\n', '-- TBL-901 alpha\nCREATE TABLE qa_beta (id INTEGER PRIMARY KEY);\n', 'db/nexus-other.sql'),
            ('07-sitemap', 'SCR-901', 'docs/07-sitemap/nexus-left.yaml', '- id: SCR-901\n  name: Orders\n', '- id: SCR-901\n  name: Buying\n', 'docs/07-sitemap/nexus-other.yaml'),
        ]
        for stage, item, path, original, proposed, missing in cases:
            (self.project / path).write_text(original, encoding='utf8')
        self.commit = self.commit_and_publish('Synthetic multi-file source fixture')
        self.read(self.session, 'push', PROJECT, '--first')
        for index, (stage, item, path, original, proposed, missing) in enumerate(cases):
            source = self.base / ('proposed-' + str(index))
            source.write_text(proposed, encoding='utf8')
            words = (PROJECT, '--part', 'nexus', '--stage', stage, '--item', item,
                     '--reason', 'Synthetic reason', '--change', 'Synthetic change', '--source-file', str(source))
            result = self.read(self.session, 'propose', *words, '--source-path', path)
            changes = result['changes']
            self.assertEqual(len(changes), 1, (stage, changes))
            self.assertEqual((changes[0]['op'], changes[0]['element'], changes[0]['name']),
                             ('rename', item, ('Buying', 'qa_beta', 'Buying')[index]))
            refused = self.refused(self.session, 'propose', *words, '--source-path', missing)
            self.assertEqual((refused['status'], refused['code'], refused['field']), (400, 'invalid_request', 'source_path'))
            data = json.dumps({'part': 'nexus', 'stage': stage, 'items': [item], 'reason': 'Synthetic reason',
                               'change': 'Synthetic change', 'source_text': proposed}).encode('utf8')
            headers = {'Content-Type': 'application/json', 'Accept': 'application/json',
                       'CF-Access-Client-Id': self.credential, 'CF-Access-Client-Secret': self.secret,
                       'Nexus-Session': self.session['CORTHEX_NEXUS_SESSION'],
                       'Idempotency-Key': '"nw_00000000000' + str(index) + '"'}
            request = urllib.request.Request(self.server.url + '/api/spaces/' + PROJECT + '/proposals',
                                             data=data, headers=headers, method='POST')
            try:
                with self.server.opener.open(request, timeout=30) as response:
                    self.fail('Expected a missing-path refusal, got %d' % response.status)
            except urllib.error.HTTPError as error:
                body = json.loads(error.read())
                self.assertEqual((error.code, body['code'], body['field']), (400, 'invalid_request', 'source_path'))
