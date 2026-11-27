"""TC-221: the 0.6.0 pinned hub against a throwaway v3 server and synthetic multi-file sources."""
import hashlib
import json
import urllib.error
import urllib.request
from pathlib import Path
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
        (erd, _), = self.drawings('05-erd')
        status, diagram = self.server.owner('GET', '/api/projects/' + PROJECT + '/diagrams/' + erd)
        self.assertEqual(status, 200)
        paths = {element['detail']['where'].rsplit(':', 1)[0] for element in diagram['elements']
                 if element.get('detail', {}).get('where', '').startswith('db/')}
        self.assertEqual(paths, {'db/nexus.sql', 'db/nexus-left.sql'})
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

        # The three 400s without paths use direct HTTP: this hub always sends a path with --source-file.
        self.assert_calls_and_log('push', *(['propose'] * 9))
        log = '\n'.join(self.log_lines)
        for _, _, path, original, proposed, missing in cases:
            for private in (path, missing, original.strip(), proposed.strip()):
                self.assertFalse(private in log, 'the log includes source data; value withheld')
        for output in self.outputs:
            self.assertFalse(hashlib.sha256(self.secret.encode('ascii')).hexdigest() in output,
                             'the hub output includes the credential digest; value withheld')

    def test_status_builds_the_v3_link_offline(self):
        # A synthetic server record models a previous successful v3 observation; upstream tests cover that observation.
        home = Path(self.session['HOME'])
        settings = home / '.corthex'
        settings.mkdir(parents=True, exist_ok=True)
        url = 'https://nexus.example.com'
        (settings / 'projects.json').write_text(json.dumps({'projects': [{'name': PROJECT, 'path': str(self.project)}]}), encoding='utf8')
        (settings / 'profile.json').write_text(json.dumps({'nexus': {'url': url, 'push': [PROJECT]}}), encoding='utf8')
        records = settings / 'hub' / 'servers'
        records.mkdir(parents=True, exist_ok=True)
        name = hashlib.sha256(url.encode('utf8')).hexdigest()[:32] + '.json'
        (records / name).write_text(json.dumps({'format': 1, 'url': url, 'v3': True, 'read': '2026-11-27T00:00:00Z'}), encoding='utf8')
        self.stop_server()
        result = self.read(self.session, 'status', PROJECT, '07-sitemap', '--part', 'nexus', '--repository',
                           '--state', 'done', '--checkpoint', 'Synthetic approval', '--by', 'the maintainer',
                           '--date', '2026-11-27', '--nexus', 'nk_000000000000')
        self.assertEqual(result['record']['checkpoints'][-1]['where'], url + '/p/' + PROJECT + '/nexus/07-sitemap')
