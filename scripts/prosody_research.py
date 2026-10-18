"""CPU-only tone research. No network, media logging or automatic promotion."""
import argparse
import hashlib
import json
import math
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

FEATURE_VERSION = 'mel16-prosody-v1'
FEATURES = [f'mel_mean_{i}' for i in range(16)] + [f'mel_std_{i}' for i in range(16)] + [
    'log_f0_std', 'log_f0_change', 'voiced_ratio', 'log_rms_mean', 'log_rms_std', 'quiet_ratio', 'log_duration']
LABELS = ['neutral', 'happy', 'sad', 'angry', 'surprised']

def load_data(path, allowed):
    data = json.loads(Path(path).read_text(encoding='utf-8-sig'))
    return validate_data(data, allowed)

def validate_data(data, allowed):
    if data.get('schemaVersion') != 1 or data.get('trainingConsent') is not True or data.get('encryptedStorageConfirmed') is not True:
        raise ValueError('Separate training consent and encrypted storage confirmation required')
    if data.get('featureVersion') != FEATURE_VERSION or data.get('features') != FEATURES:
        raise ValueError('Feature version/order mismatch')
    now = datetime.now(timezone.utc)
    people = {}
    rows = data['rows']
    if not rows:
        raise ValueError('Empty dataset')
    for row in rows:
        person, split = row['participantId'], row['split']
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', person):
            raise ValueError('Use pseudonymous participant IDs')
        if split not in allowed:
            raise ValueError('Do not use held-out test data for training/tuning')
        if person in people and people[person] != split:
            raise ValueError('Participant leakage between splits')
        people[person] = split
        consent = datetime.fromisoformat(row['consentedAt'].replace('Z', '+00:00'))
        expiry = datetime.fromisoformat(row['expiresAt'].replace('Z', '+00:00'))
        if consent.tzinfo is None or expiry.tzinfo is None or consent > now or expiry <= now or expiry > consent + timedelta(days=30, seconds=1):
            raise ValueError('Expired, future or over-30-day consent')
        values = row['values']
        if row['label'] not in LABELS or len(values) != len(FEATURES) or any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in values):
            raise ValueError('Invalid labels/features')
        if not row.get('license') or row.get('rightsVerified') is not True:
            raise ValueError('Verified data/model use rights required')
    return rows

def metrics(labels, predictions):
    per_class = {}
    for label in LABELS:
        tp = sum(a == label and b == label for a, b in zip(labels, predictions))
        fp = sum(a != label and b == label for a, b in zip(labels, predictions))
        fn = sum(a == label and b != label for a, b in zip(labels, predictions))
        p, r = tp / max(1, tp + fp), tp / max(1, tp + fn)
        per_class[label] = dict(precision=p, recall=r, f1=2*p*r/max(1e-12, p+r))
    return dict(perClass=per_class, macroF1=sum(v['f1'] for v in per_class.values())/len(LABELS))

def participant_hash(person):
    return hashlib.sha256(person.encode()).hexdigest()

def train(args):
    import numpy as np
    import torch
    import onnx
    import onnxruntime as ort
    from onnx import helper, numpy_helper, TensorProto
    if not re.fullmatch(r'[A-Za-z0-9_.-]{1,60}', args.version):
        raise ValueError('Invalid version')
    rows = load_data(args.data, {'train', 'validation'})
    train_rows = [r for r in rows if r['split'] == 'train']
    validation = [r for r in rows if r['split'] == 'validation']
    if any(not any(row['label'] == label for row in group) for group in (train_rows, validation) for label in LABELS):
        raise ValueError('Every class must be present in train and validation')
    torch.manual_seed(17)
    torch.set_num_threads(2)
    torch.use_deterministic_algorithms(True)
    x = np.asarray([r['values'] for r in train_rows], dtype=np.float32)
    mean, std = x.mean(0), np.maximum(x.std(0), .001)
    vx = np.asarray([r['values'] for r in validation], dtype=np.float32)
    tx, tv = torch.tensor((x-mean)/std), torch.tensor((vx-mean)/std)
    y = torch.tensor([LABELS.index(r['label']) for r in train_rows])
    vy = torch.tensor([LABELS.index(r['label']) for r in validation])
    net = torch.nn.Sequential(torch.nn.Linear(len(FEATURES), 64), torch.nn.ReLU(), torch.nn.Linear(64, 32), torch.nn.ReLU(), torch.nn.Linear(32, len(LABELS)))
    optimizer = torch.optim.AdamW(net.parameters(), lr=.002, weight_decay=.01)
    best, best_loss = None, float('inf')
    for _ in range(args.epochs):
        optimizer.zero_grad()
        loss = torch.nn.functional.cross_entropy(net(tx), y)
        loss.backward()
        optimizer.step()
        with torch.no_grad():
            value = torch.nn.functional.cross_entropy(net(tv), vy).item()
        if value < best_loss:
            best_loss, best = value, {k: v.detach().clone() for k,v in net.state_dict().items()}
    if best is None:
        raise ValueError('No training epochs')
    net.load_state_dict(best)
    with torch.no_grad():
        logits = net(tv)
        temperature = min((.75, 1., 1.5, 2., 3.), key=lambda t: torch.nn.functional.cross_entropy(logits/t, vy).item())
        expected = (logits/temperature).numpy()
    initializers = [numpy_helper.from_array(mean, 'mean'), numpy_helper.from_array(std, 'std')]
    nodes = [helper.make_node('Sub', ['features','mean'], ['centered']), helper.make_node('Div', ['centered','std'], ['normalized'])]
    previous = 'normalized'
    for index, layer in enumerate([net[0], net[2], net[4]]):
        initializers.extend([numpy_helper.from_array(layer.weight.detach().numpy().T, f'w{index}'), numpy_helper.from_array(layer.bias.detach().numpy(), f'b{index}')])
        output = f'layer{index}'
        nodes.append(helper.make_node('Gemm', [previous, f'w{index}', f'b{index}'], [output]))
        if index < 2:
            previous = f'relu{index}'
            nodes.append(helper.make_node('Relu', [output], [previous]))
        else:
            initializers.append(numpy_helper.from_array(np.asarray(temperature,dtype=np.float32), 'temperature'))
            nodes.append(helper.make_node('Div', [output,'temperature'], ['logits']))
    graph = helper.make_graph(nodes, 'SignEmoToneMLP', [helper.make_tensor_value_info('features', TensorProto.FLOAT, [None,len(FEATURES)])], [helper.make_tensor_value_info('logits', TensorProto.FLOAT, [None,len(LABELS)])], initializers)
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid('',17)], ir_version=10)
    onnx.checker.check_model(model)
    output = Path(args.out)
    output.mkdir(parents=True, exist_ok=True)
    file = output/'tone.onnx'
    onnx.save(model, file)
    actual = ort.InferenceSession(str(file), providers=['CPUExecutionProvider']).run(None, {'features': vx})[0]
    if not np.allclose(actual, expected, atol=1e-5, rtol=1e-5):
        raise ValueError('Python/ONNX parity failed')
    manifest = dict(version=args.version, featureVersion=FEATURE_VERSION, features=FEATURES, labels=LABELS,
                    sha256=hashlib.sha256(file.read_bytes()).hexdigest(), bytes=file.stat().st_size,
                    license='Private research; data/model rights reviewed separately', source='Consented offline SignEmo research data', researchOnly=True, participantDisjoint=True)
    manifest.update(precision='float32',runtime='onnxruntime-web-wasm',preprocessing='standardization-and-temperature-in-graph')
    report = dict(status='research-only', seed=17, temperature=temperature, participantDisjoint=True,
                  trainingParticipantHashes=sorted({participant_hash(r['participantId']) for r in train_rows}),
                  validationParticipantHashes=sorted({participant_hash(r['participantId']) for r in validation}),
                  validation=metrics([r['label'] for r in validation], [LABELS[i] for i in actual.argmax(1)]),
                  pythonOnnxMaxError=float(np.max(np.abs(actual-expected))), testEvaluated=False)
    for name, value in [('manifest.json',manifest),('evaluation.json',report),('parity.json',dict(features=vx[:10].tolist(),expected=actual[:10].tolist()))]:
        (output/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Exported research-only tone MLP; no production promotion or accuracy claim.')

def evaluate(args):
    import numpy as np
    import onnxruntime as ort
    root = Path(args.artifact)
    report = json.loads((root/'evaluation.json').read_text(encoding='utf-8'))
    if report['testEvaluated']:
        raise ValueError('Held-out test already consumed; do not retune on test')
    rows = load_data(args.data, {'test'})
    used = set(report['trainingParticipantHashes']+report['validationParticipantHashes'])
    if any(participant_hash(r['participantId']) in used for r in rows):
        raise ValueError('Participant leakage into held-out test')
    manifest = json.loads((root/'manifest.json').read_text(encoding='utf-8'))
    if hashlib.sha256((root/'tone.onnx').read_bytes()).hexdigest() != manifest['sha256']:
        raise ValueError('Model checksum mismatch')
    actual = ort.InferenceSession(str(root/'tone.onnx'), providers=['CPUExecutionProvider']).run(None, {'features':np.asarray([r['values'] for r in rows],dtype=np.float32)})[0]
    report.update(testEvaluated=True, test=metrics([r['label'] for r in rows],[LABELS[i] for i in actual.argmax(1)]))
    (root/'evaluation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('Held-out result recorded. Browser latency, fusion and pilot gates remain separate.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest='command',required=True)
    command = commands.add_parser('train')
    command.add_argument('--data',required=True)
    command.add_argument('--out',required=True)
    command.add_argument('--version',required=True)
    command.add_argument('--epochs',type=int,default=200)
    command = commands.add_parser('evaluate')
    command.add_argument('--data',required=True)
    command.add_argument('--artifact',required=True)
    args = parser.parse_args()
    (train if args.command == 'train' else evaluate)(args)
