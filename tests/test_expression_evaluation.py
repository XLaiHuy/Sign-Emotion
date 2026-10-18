import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('expression_evaluation', Path(__file__).parents[1] / 'scripts/evaluate_predictions.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ExpressionEvaluationTests(unittest.TestCase):
    def test_abstention_counts_as_missed_expression_and_missing_support_is_explicit(self):
        rows = [dict(participant_id='heldout', split='test', true_label=actual, predicted_label=predicted)
                for actual, predicted in [('fear','fear'), ('fear','uncertain'), ('disgust','fear')]]
        report = module.evaluate(rows)
        self.assertAlmostEqual(report['coverage'], 2/3)
        self.assertEqual(report['per_class']['fear']['precision'], .5)
        self.assertEqual(report['per_class']['fear']['recall'], .5)
        self.assertEqual(report['per_class']['disgust']['support'], 1)
        self.assertIsNone(report['per_class']['sad']['recall_ci95'])
        self.assertIsNone(report['per_class']['disgust']['precision_ci95'])
        self.assertLess(report['per_class']['fear']['precision_ci95'][0], .5)
        self.assertGreater(report['per_class']['fear']['precision_ci95'][1], .5)

    def test_refuses_subject_leakage_and_reports_uncertainty_for_single_success(self):
        with self.assertRaisesRegex(ValueError, 'leakage'):
            module.evaluate([dict(participant_id='same', split=split, true_label='sad', predicted_label='sad') for split in ('validation','test')])
        self.assertLess(module.wilson_interval(1,1)[0], .3)


if __name__ == '__main__': unittest.main()
