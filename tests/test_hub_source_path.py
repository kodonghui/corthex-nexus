"""TC-221: hub 1becbab against a throwaway v3 server and synthetic multi-file sources."""
import hashlib
import importlib.util
import json
import sqlite3
from contextlib import closing
import urllib.error
import urllib.request
from pathlib import Path
from types import SimpleNamespace
from test_hub_project import SKILL
from test_hub_run import HubRunFixture, PROJECT


class SourcePathWalk(HubRunFixture):
    def test_source_paths(self):
        settings = self.project / '.corthex/project.json'
        obj = json.loads(settings.read_text(encoding='utf8'))
        obj['stages']['05-erd']['source'] = 'db/'
        obj['stages']['07-sitemap']['source'] = 'docs/07-sitemap/'
        settings.write_text(json.dumps(obj), encoding='utf8')
        cases = [
            ('01-domain', 'CTX-901', 'docs/01-domain/nexus-left.md', '### CTX-901 Ordering\n', '### CTX-901 Buying\n', 'docs/01-domain/nexus-other.md', 'Buying'),
            ('05-erd', 'TBL-901', 'db/nexus-left.sql', '-- TBL-901 alpha\nCREATE TABLE qa_alpha (id INTEGER PRIMARY KEY);\n', '-- TBL-901 alpha\nCREATE TABLE qa_beta (id INTEGER PRIMARY KEY);\n', 'db/nexus-other.sql', 'qa_beta'),
            ('07-sitemap', 'SCR-901', 'docs/07-sitemap/nexus-left.yaml', '- id: SCR-901\n  name: Orders\n', '- id: SCR-901\n  name: Buying\n', 'docs/07-sitemap/nexus-other.yaml', 'Buying'),
        ]
        for stage, item, path, original, proposed, missing, expected_name in cases:
            (self.project / path).write_text(original, encoding='utf8')
        self.commit = self.commit_and_publish('Synthetic multi-file source fixture')
        self.read(self.session, 'push', PROJECT, '--first')
        status, direct = self.server.owner('POST', '/api/credentials', {'name': 'source-direct'})
        self.assertEqual(status, 201)
        direct_secret = direct['secret']
        diagrams = self.drawings('01-domain', '05-erd', '07-sitemap')
        expected = ({'docs/01-domain/nexus.md', 'docs/01-domain/nexus-left.md'},
                    {'db/nexus.sql', 'db/nexus-left.sql'},
                    {'docs/07-sitemap/nexus.yaml', 'docs/07-sitemap/nexus-left.yaml'})
        for (diagram_id, _), wanted in zip(diagrams, expected):
            status, diagram = self.server.owner('GET', '/api/projects/' + PROJECT + '/diagrams/' + diagram_id)
            self.assertEqual(status, 200)
            where = [((element.get('detail') or {}).get('where') or '') for element in diagram['elements']]
            paths = {item.rsplit(':', 1)[0] if item.rsplit(':', 1)[-1].isdigit() else item
                     for item in where if item}
            self.assertEqual(paths, wanted)
        for index, (stage, item, path, original, proposed, missing, expected_name) in enumerate(cases):
            source = self.base / ('proposed-' + str(index))
            source.write_text(proposed, encoding='utf8')
            words = (PROJECT, '--part', 'nexus', '--stage', stage, '--item', item,
                     '--reason', 'Synthetic reason', '--change', 'Synthetic change', '--source-file', str(source))
            result = self.read(self.session, 'propose', *words, '--source-path', path)
            changes = result['changes']
            self.assertEqual(len(changes), 1, (stage, changes))
            self.assertEqual((changes[0]['op'], changes[0]['element'], changes[0]['name']),
                             ('rename', item, expected_name))
            database_uri = (self.server.data / 'nexus-v3.sqlite').resolve().as_uri() + '?mode=ro'
            def proposal_count():
                with closing(sqlite3.connect(database_uri, uri=True)) as database:
                    return database.execute("SELECT count(*) FROM change_sets WHERE origin = 'proposal'").fetchone()[0]
            before_refusals = proposal_count()
            refused = self.refused(self.session, 'propose', *words, '--source-path', missing)
            self.assertEqual((refused['status'], refused['code'], refused['field'], refused['detail']),
                             (400, 'invalid_request', 'source_path', 'source_path names no file the drawing reads'))
            data = json.dumps({'part': 'nexus', 'stage': stage, 'items': [item], 'reason': 'Synthetic reason',
                               'change': 'Synthetic change', 'source_text': proposed}).encode('utf8')
            headers = {'Content-Type': 'application/json', 'Accept': 'application/json',
                       'CF-Access-Client-Id': direct['credential']['id'], 'CF-Access-Client-Secret': direct_secret,
                       'Nexus-Session': 'source-direct-session',
                       'Idempotency-Key': '"nw_00000000000' + str(index) + '"'}
            request = urllib.request.Request(self.server.url + '/api/spaces/' + PROJECT + '/proposals',
                                             data=data, headers=headers, method='POST')
            try:
                with self.server.opener.open(request, timeout=30) as response:
                    self.fail('Expected a missing-path refusal, got %d' % response.status)
            except urllib.error.HTTPError as error:
                body = json.loads(error.read())
                self.assertEqual((error.code, body['code'], body['field'], body['detail']),
                                 (400, 'invalid_request', 'source_path', 'source_path is needed: the drawing reads several files'))
            self.assertEqual(proposal_count(), before_refusals)

        # The three 400s without paths use direct HTTP: this hub always sends a path with --source-file.
        self.assert_calls_and_log('push', *(['propose'] * 6))
        log = '\n'.join(self.log_lines)
        direct_actions = [json.loads(line)['action'] for line in self.log_lines
                          if json.loads(line).get('sender') == 'source-direct']
        self.assertEqual(direct_actions, ['makeProposal'] * 3)
        for _, _, path, original, proposed, missing, expected_name in cases:
            private_parts = (path, missing, Path(path).name, Path(missing).name, expected_name,
                             *original.splitlines(), *proposed.splitlines())
            for private in private_parts:
                self.assertFalse(private in log or json.dumps(private, ensure_ascii=False)[1:-1] in log,
                                 'the log includes source data; value withheld')
        for private in (direct_secret, hashlib.sha256(direct_secret.encode('ascii')).hexdigest(), 'source-direct-session'):
            self.assertFalse(private in log, 'the server log includes direct-API credential data; value withheld')
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
        script = self.work / 'hub' / SKILL / 'scripts' / 'hub.py'
        spec = importlib.util.spec_from_file_location('qa_pinned_hub', script)
        hub = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(hub)
        hub.companion('records').remember_server(home, url, True, SimpleNamespace(**vars(hub)))
        self.stop_server()
        offline_env = dict(self.session)
        offline_env.pop('CORTHEX_NEXUS_URL', None)
        result = self.read(offline_env, 'status', PROJECT, '07-sitemap', '--part', 'nexus', '--repository',
                           '--state', 'done', '--checkpoint', 'Synthetic approval', '--by', 'the maintainer',
                           '--date', '2026-11-27', '--nexus', 'nk_000000000000')
        self.assertEqual(result['record']['checkpoints'][-1]['where'], url + '/p/' + PROJECT + '/nexus/07-sitemap')
        self.assert_calls_and_log()
        for output in self.outputs:
            self.assertFalse(hashlib.sha256(self.secret.encode('ascii')).hexdigest() in output,
                             'the hub output includes the credential digest; value withheld')
