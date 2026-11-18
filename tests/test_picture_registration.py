"""Read the product's registered picture sources through the pinned real hub."""
import copy
import json
import shutil
import subprocess
import sys

from test_nexus import ROOT, _hub_tests_path

sys.path.insert(0, _hub_tests_path)
try:
    from test_hub02 import GitSourcesFixture
finally:
    sys.path.remove(_hub_tests_path)


class PictureRegistrationTest(GitSourcesFixture):
    def test_registered_sources_include_all_three_default_git_pictures(self):
        settings = json.loads((ROOT / '.corthex/project.json').read_text(encoding='utf-8'))
        self.write(self.repo / '.corthex/project.json', settings)
        self.register(name=settings['name'])
        (self.repo / '.corthex/stages.json').unlink()  # Only the owned fixture's seed.
        (self.repo / 'docs/01-domain/domain.md').unlink()  # Not a product source.
        self.write(self.repo / '.corthex/stages/nexus.json', {
            'format': 1, 'project': settings['name'], 'part': 'nexus', 'stages': {}})
        for relative in ('docs/01-domain/nexus.md', 'docs/01-domain/rebuild.md',
                         '.corthex/stages/rebuild.json', 'docs/05-erd/nexus.md',
                         'docs/05-erd/nexus.sql', 'docs/05-erd/sources/nexus.sql',
                         'docs/05-erd/sources/rebuild.sql', 'docs/07-sitemap/nexus.yaml',
                         'docs/07-sitemap/sources/nexus.yaml', 'docs/07-sitemap/sources/rebuild.yaml'):
            destination = self.repo / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, destination)
        head = self.commit('product picture registration')
        self.git('update-ref', 'refs/remotes/origin/main', head)
        snapshot = self.snapshot()
        pictures = snapshot['pictures']
        self.assertEqual({p['stage'] for p in pictures}, {'01-domain', '05-erd', '07-sitemap'})
        self.assertTrue(all(p['commit'] == head for p in pictures))
        self.assertEqual({p['stage'] for p in pictures if p['part'] == 'nexus'}, {'01-domain', '05-erd', '07-sitemap'})
        erd = next(p for p in pictures if p['stage'] == '05-erd')
        self.assertTrue(erd['source']['tables'])

        # A new cycle cannot inherit the old cycle's contexts or approvals.
        rebuild = [p for p in snapshot['pictures'] if p['part'] == 'rebuild']
        self.assertEqual({p['stage'] for p in rebuild}, {'01-domain', '05-erd', '07-sitemap'})
        rebuild.sort(key=lambda p: p['stage'])
        self.assertEqual(len(next(p for p in rebuild if p['stage'] == '05-erd')['source']['tables']), 20)
        self.assertEqual(len(next(p for p in rebuild if p['stage'] == '07-sitemap')['source']['screens']), 11)
        self.assertEqual(rebuild[0]['stage'], '01-domain')
        self.assertTrue(rebuild[0]['source']['contexts'])
        self.assertTrue(all(c['id'] in {'CTX-032', 'CTX-033', 'CTX-034', 'CTX-035', 'CTX-036'} for c in rebuild[0]['source']['contexts']))
        # Exercise the live server comparison against the real registered
        # sources, so glossary edits alone cannot hide an inconsistent
        # aggregate inventory or a table assigned to another context.
        script = """
          import {pairPictures} from './nexus/src/crosscheck.js';
          let input='';for await (const chunk of process.stdin) input+=chunk;
          const pictures=JSON.parse(input),board=pictures.find(p=>p.stage==='01-domain').source;
          const findings=pictures.filter(p=>['05-erd','07-sitemap'].includes(p.stage)).flatMap(({stage})=>pairPictures(
            'rebuild',board,pictures.find(p=>p.stage===stage).source,
            stage==='05-erd'?'aggregate-table':'read-model-screen'));
          process.stdout.write(JSON.stringify(findings));
        """
        compared = subprocess.run(['node', '--input-type=module', '-e', script],
                                  input=json.dumps(rebuild), text=True, capture_output=True,
                                  cwd=ROOT, timeout=30)
        self.assertEqual(compared.returncode, 0, compared.stderr)
        self.assertEqual(json.loads(compared.stdout), [], 'new source pictures must agree across stages')
        for stage, value in snapshot['stages'].items():
            record = value['parts']['rebuild']
            approved_design = stage in ('01-domain', '02-prd', '03-user-flow', '04-functional-spec', '05-erd', '06-api', '07-sitemap', '08-screen-states', '09-mockup', '10-wbs')
            self.assertEqual(record['state'], 'done' if approved_design else 'not_started')
            if stage == '01-domain':
                self.assertEqual(len(record['checkpoints']), 2)
                self.assertEqual(record['checkpoints'][0]['nexus'], 'nk_n9aja7yrtm1q')
                self.assertIn('Step 1-b timeline', record['checkpoints'][0]['approved'])
            elif approved_design:
                self.assertEqual(len(record['checkpoints']), 1)
            else:
                self.assertEqual(record['checkpoints'], [])
            if approved_design:
                approval = record['checkpoints'][-1]
                self.assertEqual(approval['by'], 'the maintainer')
                self.assertEqual(approval['date'], '2026-11-18')
                self.assertIn('f4f765360a9ffdb32a5e8e5e934be1a7dcea3da9', approval['approved'])
                self.assertIn('in chat', approval['approved'])
                self.assertTrue(approval['where'].endswith('/docs/decisions/rebuild-design-approval-2026-11-18.md'))
                self.assertNotIn('nexus', approval, 'a chat approval must not invent a NEXUS user-button event')

        # The previous registration points at a present explanatory Markdown
        # file, which does not provide SQL picture input to the real parser.
        previous = copy.deepcopy(settings)
        previous['stages']['05-erd']['source'] = 'docs/05-erd/nexus.md'
        self.write(self.repo / '.corthex/project.json', previous)
        old_head = self.commit('explanatory-only registration control')
        self.git('update-ref', 'refs/remotes/origin/main', old_head)
        self.assertEqual({p['stage'] for p in self.snapshot()['pictures']}, {'01-domain', '07-sitemap'})
