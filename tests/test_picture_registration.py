"""Read the product's registered picture sources through the pinned real hub."""
import copy
import json
import shutil
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
                         'docs/05-erd/nexus.sql', 'docs/07-sitemap/nexus.yaml'):
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
        self.assertEqual(len(rebuild), 1)
        self.assertEqual(rebuild[0]['stage'], '01-domain')
        self.assertTrue(rebuild[0]['source']['contexts'])
        self.assertTrue(all(c['id'] in {'CTX-032', 'CTX-033', 'CTX-034', 'CTX-035', 'CTX-036'} for c in rebuild[0]['source']['contexts']))
        for stage, value in snapshot['stages'].items():
            record = value['parts']['rebuild']
            self.assertEqual(record['state'], 'in_progress' if stage in ('01-domain', '02-prd', '03-user-flow', '04-functional-spec') else 'not_started')
            if stage == '01-domain':
                self.assertEqual(len(record['checkpoints']), 1)
                self.assertEqual(record['checkpoints'][0]['nexus'], 'nk_n9aja7yrtm1q')
                self.assertIn('Step 1-b timeline', record['checkpoints'][0]['approved'])
            else:
                self.assertEqual(record['checkpoints'], [])

        # The previous registration points at a present explanatory Markdown
        # file, which does not provide SQL picture input to the real parser.
        previous = copy.deepcopy(settings)
        previous['stages']['05-erd']['source'] = 'docs/05-erd/nexus.md'
        self.write(self.repo / '.corthex/project.json', previous)
        old_head = self.commit('explanatory-only registration control')
        self.git('update-ref', 'refs/remotes/origin/main', old_head)
        self.assertEqual({p['stage'] for p in self.snapshot()['pictures']}, {'01-domain', '07-sitemap'})
