import copy
import importlib.util
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path

spec = importlib.util.spec_from_file_location('confidence', Path(__file__).parents[1] / 'scripts/calibrate-confidence.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ConfidenceCalibrationTests(unittest.TestCase):
    def dataset(self):
        now = datetime.now(timezone.utc)
        rows = []
        for split in ('validation', 'test'):
            for index in range(4):
                rows.append(dict(participantId=split, split=split, reference='sad' if index < 3 else 'angry',
                                 logits=[4., 0.], consentedAt=(now-timedelta(hours=1)).isoformat(),
                                 expiresAt=(now+timedelta(days=1)).isoformat(), rightsVerified=True))
        return dict(schemaVersion=1, researchConsent=True, encryptedStorageConfirmed=True,
                    license='synthetic test only', modelVersion='fixture', preprocessingVersion='fixture-v1',
                    labels=['sad', 'angry'], rows=rows)

    def test_test_labels_do_not_influence_selected_temperature(self):
        data = self.dataset()
        report = module.calibrate(data)
        other = copy.deepcopy(data)
        for row in other['rows']:
            if row['split'] == 'test': row['reference'] = 'angry'
        self.assertEqual(report['temperature'], module.calibrate(other)['temperature'])
        self.assertLessEqual(report['validation']['after']['nll'], report['validation']['before']['nll'])
        self.assertFalse(report['approved'])
        for temperature in (.25, 1, 16):
            self.assertGreater(*module.probabilities([4, 0], temperature))
        self.assertNotIn('participantId', str(report))

    def test_refuses_leakage_expired_rights_and_invalid_logits(self):
        for mutation in ('leak', 'expired', 'nan'):
            data = self.dataset()
            if mutation == 'leak': data['rows'][-1]['participantId'] = 'validation'
            if mutation == 'expired': data['rows'][0]['expiresAt'] = '2020-01-01T00:00:00+00:00'
            if mutation == 'nan': data['rows'][0]['logits'][0] = float('nan')
            with self.assertRaises(ValueError): module.calibrate(data)


if __name__ == '__main__': unittest.main()
