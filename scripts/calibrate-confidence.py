"""Validation-only temperature scaling of local logits. No media, network or training."""
import argparse
import json
import math
from datetime import datetime, timezone, timedelta
from pathlib import Path


def probabilities(logits, temperature):
    scaled = [value / temperature for value in logits]
    maximum = max(scaled)
    weights = [math.exp(value - maximum) for value in scaled]
    total = sum(weights)
    return [value / total for value in weights]


def summary(rows, labels, temperature):
    nll = 0.0
    bins = [[] for _ in range(10)]
    for row in rows:
        scores = probabilities(row['logits'], temperature)
        target = labels.index(row['reference'])
        nll -= math.log(max(scores[target], 1e-15))
        winner = max(range(len(scores)), key=scores.__getitem__)
        confidence = scores[winner]
        bins[min(9, int(confidence * 10))].append((confidence, winner == target))
    ece = sum(abs(sum(conf for conf, _ in bucket) - sum(ok for _, ok in bucket))
              for bucket in bins) / len(rows)
    return dict(rows=len(rows), nll=nll / len(rows), ece10=ece,
                support={label: sum(row['reference'] == label for row in rows) for label in labels})


def calibrate(data):
    if (data.get('schemaVersion') != 1 or data.get('researchConsent') is not True
            or data.get('encryptedStorageConfirmed') is not True or not data.get('license')
            or not data.get('modelVersion') or not data.get('preprocessingVersion')):
        raise ValueError('Explicit rights, storage and model/preprocessing provenance required')
    labels = data.get('labels')
    if (not isinstance(labels, list) or len(labels) < 2 or len(set(labels)) != len(labels)
            or any(not isinstance(label, str) or not label for label in labels)):
        raise ValueError('Exact unique model label order required')
    now = datetime.now(timezone.utc)
    people = {}
    for row in data['rows']:
        person, split = row.get('participantId'), row.get('split')
        if not person or split not in ('validation', 'test'):
            raise ValueError('Invalid participant or split')
        if person in people and people[person] != split:
            raise ValueError('Participant leakage')
        people[person] = split
        consent = datetime.fromisoformat(row['consentedAt'].replace('Z', '+00:00'))
        expiry = datetime.fromisoformat(row['expiresAt'].replace('Z', '+00:00'))
        if (consent.tzinfo is None or expiry.tzinfo is None or consent > now or expiry <= now
                or expiry > consent + timedelta(days=30) or row.get('rightsVerified') is not True):
            raise ValueError('Expired or unverified research rights')
        values = row.get('logits')
        if (not isinstance(values, list) or len(values) != len(labels)
                or any(isinstance(value, bool) or not isinstance(value, (float, int))
                       or not math.isfinite(value) for value in values)
                or row.get('reference') not in labels):
            raise ValueError('Invalid logits or reference label')
    validation = [row for row in data['rows'] if row['split'] == 'validation']
    test = [row for row in data['rows'] if row['split'] == 'test']
    if not validation:
        raise ValueError('Validation required; never tune on held-out test')
    # Fixed positive log grid; T=1 is included, and ties prefer no change.
    grid = [1.0] + [math.exp(-math.log(4) + i * math.log(64) / 120) for i in range(121)]
    temperature = min(grid, key=lambda value: summary(validation, labels, value)['nll'])
    return dict(schemaVersion=1, researchOnly=True, approved=False,
                modelVersion=data['modelVersion'], preprocessingVersion=data['preprocessingVersion'],
                labels=labels, temperature=temperature, selectedOn='validation',
                validation=dict(before=summary(validation, labels, 1), after=summary(validation, labels, temperature)),
                heldOut=dict(before=summary(test, labels, 1), after=summary(test, labels, temperature)) if test else None,
                note='Temperature preserves argmax. It does not improve class accuracy or prove emotion probabilities. No automatic application or production promotion.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    if args.out.exists():
        parser.error('Report exists; do not repeatedly inspect held-out test or overwrite evidence')
    data = json.loads(args.input.read_text(encoding='utf-8-sig'))
    report = calibrate(data)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open('x', encoding='utf-8') as file:
        json.dump(report, file, ensure_ascii=False, indent=2, allow_nan=False)
        file.write('\n')
    print('Validation-only research profile written; production unchanged.')
