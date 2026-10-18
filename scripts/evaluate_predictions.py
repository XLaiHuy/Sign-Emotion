"""Evaluate expression labels without third-party dependencies or raw images."""
import argparse
import csv
import json
import math
from pathlib import Path

LABELS = ['happy', 'sad', 'angry', 'surprised', 'fear', 'disgust', 'neutral']

def wilson_interval(successes, total):
    """95% Wilson interval; an unsupported metric has no interval, not certainty."""
    if not total:
        return None
    z = 1.959963984540054
    proportion = successes / total
    denominator = 1 + z * z / total
    center = (proportion + z * z / (2 * total)) / denominator
    radius = z * math.sqrt(proportion * (1 - proportion) / total + z * z / (4 * total * total)) / denominator
    return [max(0, center - radius), min(1, center + radius)]

def evaluate(rows):
    rows = [{key: value.strip() for key, value in row.items()} for row in rows]
    participants = {}
    matrix = {label: {pred: 0 for pred in LABELS + ['uncertain']} for label in LABELS}
    for row in rows:
        person, split = row['participant_id'].strip(), row['split'].strip()
        if not person or split not in ('train', 'validation', 'test'):
            raise ValueError('Missing participant_id or invalid split')
        if person in participants and participants[person] != split:
            raise ValueError(f'Participant leakage: {person}')
        participants[person] = split
        if row['true_label'] not in LABELS or row['predicted_label'] not in LABELS + ['uncertain']:
            raise ValueError('Unknown label')
    test = [r for r in rows if r['split'] == 'test']
    if not test:
        raise ValueError('No held-out test rows')
    for row in test:
        matrix[row['true_label']][row['predicted_label']] += 1
    metrics = {}
    for label in LABELS:
        tp = matrix[label][label]
        predicted = sum(matrix[actual][label] for actual in LABELS)
        support = sum(matrix[label].values())
        precision = tp / predicted if predicted else 0
        recall = tp / support if support else 0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
        metrics[label] = dict(precision=precision, recall=recall, f1=f1, support=support,
                              predicted=predicted, precision_ci95=wilson_interval(tp, predicted),
                              recall_ci95=wilson_interval(tp, support))
    uncertain = sum(matrix[label]['uncertain'] for label in LABELS)
    return dict(test_rows=len(test), test_participants=len({r['participant_id'] for r in test}),
                macro_f1=sum(m['f1'] for m in metrics.values()) / len(LABELS),
                coverage=1 - uncertain / len(test), per_class=metrics, confusion_matrix=matrix,
                limitations='Exploratory; labels are expressions, not internal feelings. Missing class support must be reported.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('csv_path', type=Path)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    with args.csv_path.open(encoding='utf-8-sig', newline='') as file:
        result = evaluate(list(csv.DictReader(file)))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Test rows={result["test_rows"]}, coverage={result["coverage"]:.3f}, macro-F1={result["macro_f1"]:.3f}')
