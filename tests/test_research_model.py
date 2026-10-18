"""Synthetic fixtures verify mechanics only, never real expression performance."""
import argparse
import importlib.util
import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import research_model as model

def fixture(person='synthetic_a', split='train'):
    now=datetime.now(timezone.utc)
    frames=[]
    for i in range(40):
        label='neutral' if i<20 else 'sad'
        frames.append(dict(timeMs=i*200,label=label,features=[.1 if label=='neutral' else .9]*52,ferScores=[.99]+[.01/7]*7))
    return dict(schemaVersion=1,participantId=person,split=split,trainingConsent=True,encryptedStorageConfirmed=True,
                consentedAt=now.isoformat(),expiresAt=(now+timedelta(days=29)).isoformat(),featureNames=model.FEATURE_NAMES,
                detectorSha256=model.DETECTOR_SHA,baselineModel='emotiefflib-enet-b0-8-best-afew-v1',frames=frames)

class ResearchGuards(unittest.TestCase):
    def test_consent_expiry_and_participant_leakage(self):
        with tempfile.TemporaryDirectory() as directory:
            p,q=Path(directory)/'a.json',Path(directory)/'b.json'
            first=fixture();p.write_text(json.dumps(first));q.write_text(json.dumps(fixture(split='validation')))
            with self.assertRaisesRegex(ValueError,'leakage'):model.load_datasets([p,q],{'train','validation'})
            first['trainingConsent']=False;p.write_text(json.dumps(first))
            with self.assertRaisesRegex(ValueError,'consent'):model.load_datasets([p],{'train'})
            first=fixture();first['expiresAt']='2000-01-01T00:00:00Z';p.write_text(json.dumps(first))
            with self.assertRaisesRegex(ValueError,'Expired'):model.load_datasets([p],{'train'})
            p.write_text(json.dumps(fixture(split='test')))
            with self.assertRaisesRegex(ValueError,'test data'):model.load_datasets([p],{'train','validation'})

    def test_temporal_gate_preserves_unsupported_and_invalid_abstention(self):
        gate=model.Gate();neutral=[.99]+[.01/7]*7
        self.assertEqual(gate.update(0,neutral,[.05,.95]),('uncertain',None))
        self.assertEqual(gate.update(600,neutral,[.05,.95]),('sad','sad'))
        self.assertEqual(gate.update(800,[]),('uncertain',None))
        self.assertEqual(gate.update(1000,neutral,[.05,.95]),('uncertain',None))
        unsupported=[.01/7]*8;unsupported[7]=.99
        self.assertEqual(model.Gate().update(0,unsupported,[.05,.95]),('uncertain',None))

    def test_temporal_gate_matches_time_based_smoothing_at_one_hz_and_jitter(self):
        angry=[.001]*8;angry[4]=.993
        gate=model.Gate()
        self.assertEqual(gate.update(0,angry),('uncertain',None))
        self.assertEqual(gate.update(1005,angry),('angry','angry'))
        self.assertEqual(gate.update(1218,angry),('angry',None))
        self.assertEqual(gate.update(2410,angry),('angry',None))

    def test_acceptance_rejects_better_recall_at_cost_of_false_alerts(self):
        base=model.metrics([dict(true='sad',predicted='uncertain',trigger=None),dict(true='neutral',predicted='neutral',trigger=None)])
        bad=model.metrics([dict(true='sad',predicted='sad',trigger='sad'),dict(true='neutral',predicted='sad',trigger='sad')])
        self.assertFalse(model.better(base,bad))

    @unittest.skipUnless(importlib.util.find_spec('torch') and importlib.util.find_spec('onnxruntime'),'Optional research dependencies not installed')
    def test_cpu_training_export_parity_and_one_time_test_gate(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);paths=[]
            for split in ('train','validation'):
                for i in range(2):
                    p=root/f'{split}{i}.json';p.write_text(json.dumps(fixture(f'synthetic_{split}{i}',split)));paths.append(p)
            output=root/'artifact'
            model.train(argparse.Namespace(data=paths,out=output,epochs=5,version='synthetic-test-only'))
            manifest=json.loads((output/'manifest.json').read_text())
            self.assertFalse(manifest['approved']);self.assertLess(manifest['evaluation']['pythonOnnxMaxError'],1e-5)
            test=root/'test.json';test.write_text(json.dumps(fixture('synthetic_holdout','test')))
            args=argparse.Namespace(data=[test],model=output/'neutral-sad.onnx',manifest=output/'manifest.json',out=output/'tested.json')
            model.certify(args);result=json.loads(args.out.read_text());self.assertFalse(result['approved']);self.assertFalse(result['evaluation']['sufficientCoverage'])
            args.manifest=args.out
            with self.assertRaisesRegex(ValueError,'already consumed'):model.certify(args)

if __name__=='__main__':unittest.main()
