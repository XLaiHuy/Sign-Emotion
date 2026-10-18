"""Synthetic mechanics only: no Vietnamese tone quality claim."""
import argparse
from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
import prosody_research as research

def dataset(split, person):
    now = datetime.now(timezone.utc)
    return dict(schemaVersion=1, trainingConsent=True, encryptedStorageConfirmed=True,
                featureVersion=research.FEATURE_VERSION, features=research.FEATURES,
                rows=[dict(participantId=person, split=split, label=label, values=[float(i)]*len(research.FEATURES),
                           consentedAt=now.isoformat(), expiresAt=(now+timedelta(days=29)).isoformat(),
                           license='Synthetic test only', rightsVerified=True) for i,label in enumerate(research.LABELS)])

class ProsodyGuards(unittest.TestCase):
    def test_consent_expiry_split_and_feature_order(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory)/'data.json'
            data = dataset('train','speaker')
            file.write_text(json.dumps(data))
            self.assertEqual(len(research.load_data(file, {'train'})),5)
            data['rows'].append(dict(data['rows'][0],split='validation'))
            file.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError,'leakage'): research.load_data(file,{'train','validation'})
            data = dataset('test','speaker')
            file.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError,'held-out'): research.load_data(file,{'train','validation'})
            data = dataset('train','speaker')
            data['rows'][0]['expiresAt']='2000-01-01T00:00:00Z'
            file.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError,'Expired'): research.load_data(file,{'train'})
            data = dataset('train','speaker'); data['trainingConsent']=False
            file.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError,'consent'): research.load_data(file,{'train'})
    @unittest.skipUnless(importlib.util.find_spec('torch') and importlib.util.find_spec('onnxruntime'),'Research dependencies absent')
    def test_cpu_export_parity_and_one_time_holdout(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            data=dataset('train','train_speaker'); data['rows']+=dataset('validation','val_speaker')['rows']
            file=root/'data.json'; file.write_text(json.dumps(data))
            output=root/'artifact'
            research.train(argparse.Namespace(data=file,out=output,version='synthetic-only',epochs=3))
            manifest=json.loads((output/'manifest.json').read_text())
            self.assertTrue(manifest['researchOnly'])
            self.assertLess(manifest['bytes'],5*1048576)
            report=json.loads((output/'evaluation.json').read_text())
            self.assertLess(report['pythonOnnxMaxError'],1e-5)
            file.write_text(json.dumps(dataset('test','test_speaker')))
            args=argparse.Namespace(data=file,artifact=output)
            research.evaluate(args)
            with self.assertRaisesRegex(ValueError,'already consumed'): research.evaluate(args)

if __name__ == '__main__': unittest.main()
