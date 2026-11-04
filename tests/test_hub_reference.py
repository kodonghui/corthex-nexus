import json,os,subprocess,sys,tempfile,unittest
from pathlib import Path
from unittest import mock
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from hub_ref import reference,locate_hub
class HubReferenceTest(unittest.TestCase):
 def test_exact_reference_is_present_and_clean(self):
  checkout=locate_hub();self.assertEqual(reference()['commit'],subprocess.check_output(['git','-C',str(checkout),'rev-parse','HEAD'],text=True).strip())
 def test_a_different_checkout_is_refused_before_hub_import(self):
  with tempfile.TemporaryDirectory() as raw:
   with mock.patch.dict(os.environ,{'CORTHEX_HUB_CHECKOUT':raw}):
    with self.assertRaisesRegex(RuntimeError,'does not match'):locate_hub()
 def test_no_ambient_dependency_is_silently_fetched(self):
  with mock.patch.dict(os.environ,{},clear=True):
   with self.assertRaisesRegex(RuntimeError,'Set CORTHEX_HUB_CHECKOUT'):locate_hub()
