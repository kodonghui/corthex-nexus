"""Keep the public/private synthetic sample honest and its source receipt current."""
import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / 'docs/06-api/sources/rebuild/openapi.json'

class RebuildSampleContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = json.loads(CONTRACT.read_text())
        cls.operations = {op['operationId']: op for methods in cls.contract['paths'].values()
                          for op in methods.values()}

    def allows_null(self, schema):
        if '$ref' in schema:
            value = self.contract
            for key in schema['$ref'].removeprefix('#/').split('/'):
                value = value[key]
            return self.allows_null(value)
        kind = schema.get('type')
        return kind == 'null' or isinstance(kind, list) and 'null' in kind or any(
            self.allows_null(choice) for key in ('anyOf', 'oneOf') for choice in schema.get(key, []))

    def test_private_sample_has_no_invented_repository_or_verification(self):
        project = self.contract['components']['schemas']['Project']
        for field in ('repository_url', 'default_branch'):
            self.assertIn(field, project['required'])
            self.assertTrue(self.allows_null(project['properties'][field]), field)
        self.assertIn('not_connected', project['properties']['verification_state']['enum'])
        sample = self.operations['createPrivateSampleProject']['responses']['201']['content'][
            'application/json']['examples']['success']['value']
        self.assertIs(sample['synthetic'], True)
        self.assertIsNone(sample['repository_url'])
        self.assertIsNone(sample['default_branch'])
        self.assertEqual(sample['verification_state'], 'not_connected')

    def test_public_sample_has_nonempty_source_with_matching_digests(self):
        response = self.operations['getPublicSample']['responses']['200']['content']['application/json']
        schema = self.contract
        for key in response['schema']['$ref'].removeprefix('#/').split('/'):
            schema = schema[key]
        self.assertGreaterEqual(schema['properties']['source_files']['minItems'], 1)
        sample = response['examples']['success']['value']
        self.assertIs(sample['synthetic'], True)
        self.assertTrue(sample['source_files'])
        for source in sample['source_files']:
            self.assertTrue(source['content_utf8'].strip())
            self.assertEqual(source['sha256'], hashlib.sha256(source['content_utf8'].encode('utf8')).hexdigest())

    def test_static_review_receipt_identifies_the_exact_checked_contract(self):
        receipt = json.loads((ROOT / 'docs/06-api/rebuild-validation.json').read_text())
        self.assertEqual(receipt['contractSha256'], hashlib.sha256(CONTRACT.read_bytes()).hexdigest())
        self.assertTrue(receipt['passed'])
        self.assertIs(receipt['real_service_tested'], False)
        self.assertIs(receipt['production_data_used'], False)

if __name__ == '__main__':
    unittest.main()
