"""Offline neutral/sad research. No media/network I/O. Not evidence of emotion accuracy."""
import argparse
import copy
import hashlib
import json
import math
import re
from collections import Counter
from datetime import datetime, timezone, timedelta
from pathlib import Path

LABELS = ['happy', 'sad', 'angry', 'surprised', 'fear', 'disgust', 'neutral']
FER_LABELS = ['neutral', 'happy', 'surprised', 'sad', 'angry', 'disgust', 'fear', 'contempt']
BASELINE_MODEL = 'emotiefflib-enet-b0-8-best-afew-v1'
DETECTOR_SHA = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff'
FEATURE_NAMES = ['_neutral','browDownLeft','browDownRight','browInnerUp','browOuterUpLeft','browOuterUpRight','cheekPuff','cheekSquintLeft','cheekSquintRight','eyeBlinkLeft','eyeBlinkRight','eyeLookDownLeft','eyeLookDownRight','eyeLookInLeft','eyeLookInRight','eyeLookOutLeft','eyeLookOutRight','eyeLookUpLeft','eyeLookUpRight','eyeSquintLeft','eyeSquintRight','eyeWideLeft','eyeWideRight','jawForward','jawLeft','jawOpen','jawRight','mouthClose','mouthDimpleLeft','mouthDimpleRight','mouthFrownLeft','mouthFrownRight','mouthFunnel','mouthLeft','mouthLowerDownLeft','mouthLowerDownRight','mouthPressLeft','mouthPressRight','mouthPucker','mouthRight','mouthRollLower','mouthRollUpper','mouthShrugLower','mouthShrugUpper','mouthSmileLeft','mouthSmileRight','mouthStretchLeft','mouthStretchRight','mouthUpperUpLeft','mouthUpperUpRight','noseSneerLeft','noseSneerRight']

def utc(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('Timezone required')
    return result

def valid_vector(values, size):
    return isinstance(values, list) and len(values) == size and all(isinstance(v, (int, float)) and math.isfinite(v) and 0 <= v <= 1 for v in values)

def load_datasets(paths, allowed_splits):
    datasets, participants = [], {}
    now = datetime.now(timezone.utc)
    for path in paths:
        data = json.loads(Path(path).read_text(encoding='utf-8-sig'))
        if data.get('schemaVersion') != 1 or data.get('trainingConsent') is not True or data.get('encryptedStorageConfirmed') is not True:
            raise ValueError('Separate training consent/encrypted storage confirmation required')
        consent, expiry = utc(data['consentedAt']), utc(data['expiresAt'])
        if consent > now or expiry <= now or expiry > consent + timedelta(days=30, seconds=1):
            raise ValueError('Expired, future or over-30-day consent')
        person, split = data['participantId'], data['split']
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,40}', person) or split not in allowed_splits:
            raise ValueError('Invalid participant/split; test data must not enter training/calibration')
        if person in participants and participants[person] != split:
            raise ValueError('Participant leakage between splits')
        participants[person] = split
        if data.get('featureNames') != FEATURE_NAMES or data.get('detectorSha256') != DETECTOR_SHA or data.get('baselineModel') != BASELINE_MODEL:
            raise ValueError('Feature/preprocessing/model contract mismatch')
        previous = -1
        if not data.get('frames'):
            raise ValueError('Empty dataset')
        for index, frame in enumerate(data['frames']):
            t = frame['timeMs']
            if not isinstance(t, (int, float)) or not math.isfinite(t) or t < 0 or t <= previous:
                raise ValueError('Frame times must increase')
            previous = t
            if t != index*200:
                raise ValueError('Use a complete deterministic 5 Hz run, including ignored/invalid frames')
            if frame['label'] not in FER_LABELS + ['ignore']:
                raise ValueError('Unknown reference label')
            if frame.get('features') is not None and not valid_vector(frame['features'], 52):
                raise ValueError('Invalid feature vector')
            if frame.get('ferScores') and not valid_vector(frame['ferScores'], 8):
                raise ValueError('Invalid FER scores')
        data['_digest'] = hashlib.sha256(Path(path).read_bytes()).hexdigest()
        datasets.append(data)
    if not datasets:
        raise ValueError('No datasets')
    return datasets

class Gate:
    """Temporal parity with PredictionGate. Reset per clip; timestamps are media time."""
    EMA_TIME_CONSTANT_MS = 150

    def __init__(self, threshold=.65, dwell=200, cooldown=3000, profile=None):
        self.threshold, self.dwell, self.cooldown, self.profile = threshold, dwell, cooldown, profile
        self.ema = self.aux = self.candidate = self.emitted = None
        self.since = 0
        self.last_frame = self.last_haptic = -math.inf

    def update(self, timestamp, scores, auxiliary=None, aux_threshold=.8, aux_margin=.15):
        if timestamp < self.last_frame:
            return 'uncertain', None
        elapsed = timestamp - self.last_frame if math.isfinite(self.last_frame) else 0
        self.last_frame = timestamp
        if not valid_vector(scores, 8):
            self.ema = self.aux = self.candidate = None
            return 'uncertain', None
        alpha = 1 - math.exp(-max(0, elapsed) / self.EMA_TIME_CONSTANT_MS) if self.ema else 1
        self.ema = [alpha*v+(1-alpha)*old for v, old in zip(scores, self.ema)] if self.ema else list(scores)
        winner = max(range(8), key=lambda i: self.ema[i])
        label = FER_LABELS[winner]
        threshold = self.profile['thresholds'].get(label, self.threshold) if self.profile else self.threshold
        margin = self.profile['margins'].get(label, 0) if self.profile else 0
        observed_margin = self.ema[winner] - max(v for i,v in enumerate(self.ema) if i != winner)
        valid = label in LABELS and self.ema[winner] >= threshold and self.ema[winner] - max(v for i,v in enumerate(self.ema) if i != winner) >= margin
        if auxiliary is not None and winner in (0,3):
            if not valid_vector(auxiliary, 2):
                self.candidate = None
                return 'uncertain', None
            self.aux = [alpha*v+(1-alpha)*old for v,old in zip(auxiliary,self.aux)] if self.aux else list(auxiliary)
            label = 'sad' if self.aux[1] > self.aux[0] else 'neutral'
            valid = max(self.aux) >= aux_threshold and abs(self.aux[1]-self.aux[0]) >= aux_margin
            observed_margin = abs(self.aux[1]-self.aux[0])
        else:
            self.aux = None
        if not valid:
            self.candidate = None
            return 'uncertain', None
        if self.candidate != label:
            self.candidate, self.since = label, timestamp
        effective_dwell = self.dwell * (.6 if observed_margin >= .35 else 1 if observed_margin >= .2 else 1.6)
        if timestamp-self.since < effective_dwell:
            return 'uncertain', None
        if label == 'neutral':
            self.emitted = label
            return label, None
        trigger = label if timestamp-self.since >= max(self.dwell,400) and self.emitted != label and timestamp-self.last_haptic >= self.cooldown else None
        if trigger:
            self.emitted, self.last_haptic = label, timestamp
        return label, trigger

def metrics(rows):
    rows = [r for r in rows if r['true'] != 'ignore']
    per_class = {}
    for label in LABELS:
        tp = sum(r['true'] == label and r['predicted'] == label for r in rows)
        support = sum(r['true'] == label for r in rows)
        predicted = sum(r['predicted'] == label for r in rows)
        precision, recall = tp/predicted if predicted else 0, tp/support if support else 0
        per_class[label] = dict(support=support, precision=precision, recall=recall, f1=2*precision*recall/(precision+recall) if precision+recall else 0)
    neutral = [r for r in rows if r['true']=='neutral']
    false = sum(bool(r['trigger']) and r['trigger'] != r['true'] for r in rows)
    confusion = {}
    for r in rows:
        cell=confusion.setdefault(r['true'], {})
        cell[r['predicted']]=cell.get(r['predicted'],0)+1
    return dict(samples=len(rows), perClass=per_class, macroF1=sum(m['f1'] for m in per_class.values())/len(LABELS),
                coverage=sum(r['predicted']!='uncertain' for r in rows)/len(rows) if rows else 0,
                neutralFalseSadRate=sum(r['predicted']=='sad' for r in neutral)/len(neutral) if neutral else 0,
                falseTriggersPerMinute=false/(len(rows)*.2/60) if rows else 0, confusion=confusion)

def replay(datasets, predictor=None, threshold=.8, margin=.15, profile=None):
    rows=[]
    for data in datasets:
        settings=data.get('settings',{})
        gate=Gate(settings.get('threshold',.65),settings.get('dwellMs',200),settings.get('cooldownMs',3000),profile)
        for frame in data['frames']:
            aux=predictor(frame['features']) if predictor and frame.get('features') is not None else None
            # An invalid frame must reset both baseline and auxiliary state.
            predicted,trigger=gate.update(frame['timeMs'],frame.get('ferScores',[]),aux,threshold,margin)
            rows.append(dict(true=frame['label'],predicted=predicted,trigger=trigger,participant=data['participantId']))
    return metrics(rows),{person:metrics([r for r in rows if r['participant']==person]) for person in sorted({r['participant'] for r in rows})}

def better(base, candidate):
    return (candidate['perClass']['sad']['recall'] > base['perClass']['sad']['recall'] and
            candidate['perClass']['sad']['precision'] >= base['perClass']['sad']['precision'] and
            candidate['neutralFalseSadRate'] <= base['neutralFalseSadRate'] and
            candidate['falseTriggersPerMinute'] <= base['falseTriggersPerMinute'] and
            candidate['macroF1'] >= base['macroF1'])

def save(path, value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,indent=2,ensure_ascii=False),encoding='utf-8')

def participant_hash(person):
    return hashlib.sha256(person.encode()).hexdigest()

def train(args):
    if not re.fullmatch(r'[A-Za-z0-9_.-]{1,40}',args.version):
        raise ValueError('Model version must be 1–40 ASCII letters/digits/dot/dash/underscore')
    import numpy as np
    import torch
    import onnx
    from onnx import helper, numpy_helper, TensorProto
    data=load_datasets(args.data,{'train','validation'})
    training=[d for d in data if d['split']=='train'];validation=[d for d in data if d['split']=='validation']
    if not training or not validation:
        raise ValueError('Separate train and validation participants required')
    def pairs(items):
        return [(d['participantId'],f) for d in items for f in d['frames'] if f['label'] in ('neutral','sad') and f.get('features') is not None]
    tr,va=pairs(training),pairs(validation)
    if any(not any(f['label']==label for _,f in group) for group in (tr,va) for label in ('neutral','sad')):
        raise ValueError('Both neutral and sad required in train and validation')
    torch.manual_seed(17);torch.set_num_threads(2);torch.use_deterministic_algorithms(True)
    x=np.asarray([f['features'] for _,f in tr],dtype=np.float32);y=np.asarray([int(f['label']=='sad') for _,f in tr],dtype=np.int64)
    mean=x.mean(axis=0);scale=np.maximum(x.std(axis=0),1e-5)
    vx=torch.from_numpy((np.asarray([f['features'] for _,f in va],dtype=np.float32)-mean)/scale)
    vy=torch.tensor([int(f['label']=='sad') for _,f in va])
    net=torch.nn.Sequential(torch.nn.Linear(52,64),torch.nn.ReLU(),torch.nn.Linear(64,32),torch.nn.ReLU(),torch.nn.Linear(32,2))
    optimizer=torch.optim.Adam(net.parameters(),lr=.001,weight_decay=.001)
    counts=Counter((p,f['label']) for p,f in tr)
    weights=torch.tensor([1/counts[(p,f['label'])] for p,f in tr],dtype=torch.float32)
    sampler=torch.utils.data.WeightedRandomSampler(weights,len(tr),replacement=True,generator=torch.Generator().manual_seed(17))
    loader=torch.utils.data.DataLoader(torch.utils.data.TensorDataset(torch.from_numpy((x-mean)/scale),torch.from_numpy(y)),batch_size=64,sampler=sampler)
    loss_fn=torch.nn.CrossEntropyLoss();best_loss=math.inf;best=None;patience=0
    for _ in range(args.epochs):
        net.train()
        for bx,by in loader:
            optimizer.zero_grad();loss=loss_fn(net(bx),by);loss.backward();optimizer.step()
        net.eval()
        with torch.no_grad():loss=float(loss_fn(net(vx),vy))
        if loss<best_loss-1e-5:best_loss=loss;best=copy.deepcopy(net.state_dict());patience=0
        else:patience+=1
        if patience>=30:break
    net.load_state_dict(best);net.eval()
    # Export only standard ONNX operators, including standardization in graph.
    # Avoid ai.onnx.ml operators / Python pickles and exporter-specific runtime dependencies.
    nodes=[helper.make_node('Sub',['features','mean'],['centered']),helper.make_node('Div',['centered','scale'],['normalized'])]
    initializers=[numpy_helper.from_array(mean,'mean'),numpy_helper.from_array(scale,'scale')];previous='normalized'
    for index,layer in enumerate([net[0],net[2],net[4]]):
        w,b=f'w{index}',f'b{index}';initializers += [numpy_helper.from_array(layer.weight.detach().numpy().T.copy(),w),numpy_helper.from_array(layer.bias.detach().numpy().copy(),b)]
        nodes += [helper.make_node('MatMul',[previous,w],[f'm{index}']),helper.make_node('Add',[f'm{index}',b],[f'a{index}'])]
        previous=f'a{index}'
        if index<2:nodes.append(helper.make_node('Relu',[previous],[f'r{index}']));previous=f'r{index}'
    nodes.append(helper.make_node('Softmax',[previous],['scores'],axis=1))
    graph=helper.make_graph(nodes,'SignEmoNeutralSad',[helper.make_tensor_value_info('features',TensorProto.FLOAT,[None,52])],[helper.make_tensor_value_info('scores',TensorProto.FLOAT,[None,2])],initializers)
    model=helper.make_model(graph,opset_imports=[helper.make_opsetid('',17)],producer_name='SignEmo research');model.ir_version=8;onnx.checker.check_model(model)
    output=Path(args.out);output.mkdir(parents=True,exist_ok=True);model_path=output/'neutral-sad.onnx';onnx.save(model,model_path)
    import onnxruntime as ort
    session=ort.InferenceSession(str(model_path),providers=['CPUExecutionProvider'])
    def predict(values):return session.run(None,{'features':np.asarray([values],dtype=np.float32)})[0][0].tolist()
    with torch.no_grad():expected=torch.softmax(net(vx),dim=1).numpy()
    actual=session.run(None,{'features':np.asarray([f['features'] for _,f in va],dtype=np.float32)})[0]
    if not np.allclose(expected,actual,atol=1e-5,rtol=1e-5):raise ValueError('Python/ONNX parity failed')
    baseline,_=replay(validation);best_score=-1;threshold,margin=.8,.15;val_metrics=None
    for th in (.65,.7,.75,.8,.85,.9,.95):
        for gap in (0,.05,.1,.15,.2):
            candidate,_=replay(validation,predict,th,gap)
            score=candidate['perClass']['sad']['recall'] if better(baseline,candidate) else -1
            if score>best_score:best_score=score;threshold,margin=th,gap;val_metrics=candidate
    if val_metrics is None:val_metrics,_=replay(validation,predict,threshold,margin)
    manifest=dict(version=args.version,sha256=hashlib.sha256(model_path.read_bytes()).hexdigest(),bytes=model_path.stat().st_size,
                  featureNames=FEATURE_NAMES,detectorSha256=DETECTOR_SHA,labels=['neutral','sad'],preprocessing='standardization-in-graph',
                  threshold=threshold,margin=margin,approved=False,source='Consented offline SignEmo research data',license='Private research; no redistribution without data/model rights review',
                  evaluation=dict(validationBaseline=baseline,validationCandidate=val_metrics,validationPassed=better(baseline,val_metrics),
                                  trainingParticipantHashes=[participant_hash(p) for p in sorted({d['participantId'] for d in training})],
                                  validationParticipantHashes=[participant_hash(p) for p in sorted({d['participantId'] for d in validation})],
                                  datasetDigests=[d['_digest'] for d in data],seed=17,pythonOnnxMaxError=float(np.max(np.abs(expected-actual))),testEvaluated=False))
    save(output/'manifest.json',manifest)
    save(output/'parity.json',dict(features=[f['features'] for _,f in va[:10]],expected=actual[:10].tolist()))
    print('Exported experimental ONNX + manifest. Not approved for camera; independent test required.')

def certify(args):
    import numpy as np
    import onnxruntime as ort
    model=Path(args.model);manifest=json.loads(Path(args.manifest).read_text(encoding='utf-8'))
    if manifest.get('evaluation',{}).get('testEvaluated'):
        raise ValueError('This candidate already consumed its test. Use a new independent test for the next iteration.')
    if hashlib.sha256(model.read_bytes()).hexdigest()!=manifest['sha256']:raise ValueError('Model checksum mismatch')
    data=load_datasets(args.data,{'test'});meta=manifest['evaluation']
    people={d['participantId'] for d in data}
    if {participant_hash(p) for p in people}&set(meta['trainingParticipantHashes']+meta['validationParticipantHashes']):raise ValueError('Participant leakage into held-out test')
    session=ort.InferenceSession(str(model),providers=['CPUExecutionProvider'])
    predict=lambda values:session.run(None,{'features':np.asarray([values],dtype=np.float32)})[0][0].tolist()
    baseline,baseline_people=replay(data);candidate,candidate_people=replay(data,predict,manifest['threshold'],manifest['margin'])
    # Five supported classes + unsupported negatives must be represented before activation.
    present={f['label'] for d in data for f in d['frames']}
    sufficient=(set(FER_LABELS)<=present and len(people)>=2 and len(meta['trainingParticipantHashes'])>=2 and len(meta['validationParticipantHashes'])>=2)
    manifest['approved']=bool(sufficient and meta['validationPassed'] and better(baseline,candidate))
    meta.update(testEvaluated=True,testBaseline=baseline,testCandidate=candidate,testBaselinePerParticipant=baseline_people,testCandidatePerParticipant=candidate_people,
                testDatasetDigests=[d['_digest'] for d in data],sufficientCoverage=sufficient,limitations='Exploratory; expressions are not internal feelings. No real Android motor or utility claim.')
    save(args.out,manifest);print('Approved for local camera' if manifest['approved'] else 'Remains experimental: insufficient coverage or acceptance criteria not met')

def calibrate(args):
    data=load_datasets(args.data,{'validation'});baseline,_=replay(data);profile=dict(thresholds={},margins={});best=baseline
    for th in (.5,.55,.6,.65,.7,.75,.8,.85,.9):
        for gap in (0,.05,.1,.15,.2):
            trial=copy.deepcopy(profile);trial['thresholds']['sad']=th;trial['margins']['sad']=gap
            result,_=replay(data,profile=trial)
            if better(baseline,result) and result['perClass']['sad']['recall']>best['perClass']['sad']['recall']:best=result;profile=trial
    save(args.out,profile);save(str(args.out)+'.evaluation.json',dict(baseline=baseline,candidate=best,improved=better(baseline,best),split='validation',approvedForCamera=False))
    print('Validation-only profile exported; lowering threshold cannot recover sad when neutral wins.')

def main():
    parser=argparse.ArgumentParser(description=__doc__);sub=parser.add_subparsers(dest='command',required=True)
    for name in ('train','certify','calibrate'):
        p=sub.add_parser(name);p.add_argument('--data',nargs='+',required=True,type=Path);p.add_argument('--out',type=Path,required=True)
        p.add_argument('--encrypted-output-confirmed',action='store_true',required=True)
        if name=='train':p.add_argument('--epochs',type=int,default=300);p.add_argument('--version',default='neutral-sad-mlp-v1')
        if name=='certify':p.add_argument('--model',type=Path,required=True);p.add_argument('--manifest',type=Path,required=True)
    args=parser.parse_args()
    if getattr(args,'epochs',1)<1 or getattr(args,'epochs',1)>2000:parser.error('epochs must be 1–2000')
    try:{'train':train,'certify':certify,'calibrate':calibrate}[args.command](args)
    except (ValueError,KeyError,ImportError) as error:parser.exit(2,f'{error}\n')

if __name__=='__main__':main()
