import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('evaluator', Path(__file__).parents[1] / 'scripts/evaluate_predictions.py')
evaluator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluator)

class EvaluationTests(unittest.TestCase):
    def test_participant_leakage_rejected(self):
        rows = [dict(participant_id='p1', split=s, true_label='happy', predicted_label='happy') for s in ('train','test')]
        with self.assertRaisesRegex(ValueError, 'leakage'):
            evaluator.evaluate(rows)

    def test_abstention_counts_as_false_negative_and_reduces_coverage(self):
        rows = [dict(participant_id=' p1 ', split=' test ', true_label='happy', predicted_label=p) for p in ('happy','uncertain')]
        result = evaluator.evaluate(rows)
        self.assertEqual(result['test_rows'], 2)
        self.assertEqual(result['coverage'], .5)
        self.assertEqual(result['per_class']['happy']['recall'], .5)
        self.assertEqual(result['per_class']['happy']['precision'], 1)
        self.assertEqual(result['per_class']['sad']['support'], 0)

if __name__ == '__main__':
    unittest.main()
