# Code từng cell cho Kaggle — GTSRB

Đổi ROOT nếu đường dẫn Input khác. Bật GPU. Chạy lần lượt 11 cell.

Lượt đầu Gamma=False; lượt sau mới bật Gamma. Các điểm cải thiện chưa được train xác nhận.

GTSRB: notebook ngắn, train từ đầu
Bật GPU, thêm dataset exam1_cv, rồi Run All. Lượt đầu giữ GAMMA=False.
Thử Gamma ở lượt sau; đổi RUN tự động giữ riêng checkpoint và history.
Hai cột nộp đúng: sample_id,label. Mọi cải tiến cần validation xác nhận.

## Cell 1 — Import và cấu hình

```python
# Cell 1 — Import và cấu hình
from pathlib import Path
from functools import lru_cache
import json, math, random, time
import numpy as np
import pandas as pd
from PIL import Image
import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms as T
from torchvision.transforms import functional as TF, InterpolationMode
from sklearn.metrics import f1_score, accuracy_score, classification_report, confusion_matrix
from tqdm.auto import tqdm

ROOT = Path('/kaggle/input/datasets/huyzzz2109/dataset-phanloaibienbaogiaothong/exam1_cv')
OUT = Path('/kaggle/working/cv_short'); OUT.mkdir(exist_ok=True)
SIZE, BATCH, EPOCHS, SEED = 64, 128, 30, 2026
LR, WD, GAMMA, BLOCKS = 1e-3, 5e-4, False, (1, 1, 1, 1)
BASELINE_CKPT = ''  # Tùy chọn: đường dẫn A_ce48_best.pt đã thêm vào Kaggle Input
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
CUDA = DEVICE.type == 'cuda'
WORKERS = 4 if CUDA else 0
AMP = CUDA and torch.cuda.get_device_capability()[0] >= 7  # Có thể tắt để đối chứng
RUN = f'ce{SIZE}_g{int(GAMMA)}_b{"".join(map(str, BLOCKS))}_lr{LR:g}_s{SEED}_a{int(AMP)}'
random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)
if CUDA:
    torch.cuda.manual_seed_all(SEED)
    torch.backends.cudnn.benchmark = True  # Nhanh; không bảo đảm bitwise reproducibility
print(RUN, DEVICE, 'AMP:', AMP, 'torch:', str(torch.__version__))
if CUDA: print(torch.cuda.get_device_name())
```

## Cell 2 — Đọc CSV, giữ nguyên split của đề

```python
# Cell 2 — Đọc CSV, giữ nguyên split của đề
assert (ROOT / 'train.csv').is_file(), 'Sửa ROOT theo thư mục Input của bạn.'
frames = {s: pd.read_csv(ROOT / f'{s}.csv', dtype={'sample_id': str})
          for s in ['train', 'validation', 'public_test', 'private_test']}
tr, va = frames['train'], frames['validation']
assert set(tr.sample_id).isdisjoint(va.sample_id)
for name, df in frames.items():
    assert df.sample_id.is_unique and df[['sample_id', 'image']].notna().all().all()
    if 'label' in df: assert df.label.notna().all() and df.label.isin(range(43)).all()
    print(name, len(df))
assert set(tr.label) == set(range(43))
```

## Cell 3 — Cache ảnh uint8; mọi resolution đều đọc từ ảnh gốc

```python
# Cell 3 — Cache ảnh uint8; mọi resolution đều đọc từ ảnh gốc
@lru_cache(maxsize=8)
def images(split, size):
    arr = np.empty((len(frames[split]), size, size, 3), dtype=np.uint8)
    for i, rel in enumerate(tqdm(frames[split].image, desc=f'{split} {size}')):
        with Image.open(ROOT / rel) as im:
            arr[i] = np.asarray(im.convert('RGB').resize((size, size), Image.Resampling.BILINEAR))
    return arr

def channel_stats(arr):
    sums, squares, count = np.zeros(3), np.zeros(3), 0
    for start in range(0, len(arr), 256):
        x = arr[start:start+256].astype(np.float64) / 255
        sums += x.sum((0, 1, 2)); squares += (x*x).sum((0, 1, 2))
        count += x.shape[0] * x.shape[1] * x.shape[2]
    mean = sums / count
    return mean.tolist(), np.sqrt(np.maximum(squares/count - mean*mean, 1e-8)).tolist()

mean, std = channel_stats(images('train', SIZE))
images('validation', SIZE)
print('Train mean/std:', mean, std)
```

## Cell 4 — Transform -> Dataset -> DataLoader

```python
# Cell 4 — Transform -> Dataset -> DataLoader
class RandomGamma:
    def __call__(self, image):
        if torch.rand(()) < 0.3:
            return TF.adjust_gamma(image, float(torch.empty(()).uniform_(0.7, 1.5)))
        return image

def transform(mean, std, training=False, gamma=False):
    ops = []
    if training:
        ops = [T.RandomAffine(8, translate=(.05, .05), scale=(.95, 1.05),
                              interpolation=InterpolationMode.BILINEAR),
               T.ColorJitter(brightness=.15, contrast=.15, saturation=.10)]
        if gamma: ops.append(RandomGamma())
    return T.Compose(ops + [T.ToTensor(), T.Normalize(mean, std)])

class Signs(Dataset):
    def __init__(self, split, size, tfm):
        self.x, self.tfm = images(split, size), tfm
        df = frames[split]
        self.y = df.label.to_numpy(dtype=np.int64) if 'label' in df else np.full(len(df), -1)
    def __len__(self): return len(self.y)
    def __getitem__(self, i): return self.tfm(Image.fromarray(self.x[i])), int(self.y[i])

def loader(split, size, mean, std, training=False, gamma=False):
    ds = Signs(split, size, transform(mean, std, training, gamma))
    return DataLoader(ds, batch_size=BATCH, shuffle=training, num_workers=WORKERS,
                      pin_memory=CUDA, persistent_workers=WORKERS > 0,
                      generator=torch.Generator().manual_seed(SEED))

train_dl = loader('train', SIZE, mean, std, True, GAMMA)
valid_dl = loader('validation', SIZE, mean, std)
xb, yb = next(iter(train_dl))
assert xb.shape[1:] == (3, SIZE, SIZE) and torch.isfinite(xb).all()
assert yb.dtype == torch.int64
print('Batch:', xb.shape, yb.shape)
```

## Cell 5 — MiniResNet: giữ tên layer để load được checkpoint notebook cũ

```python
# Cell 5 — MiniResNet: giữ tên layer để load được checkpoint notebook cũ
class ResidualBlock(nn.Module):
    def __init__(self, cin, cout, stride=1):
        super().__init__()
        self.main = nn.Sequential(
            nn.Conv2d(cin, cout, 3, stride, 1, bias=False), nn.BatchNorm2d(cout), nn.ReLU(),
            nn.Conv2d(cout, cout, 3, 1, 1, bias=False), nn.BatchNorm2d(cout))
        self.shortcut = nn.Identity() if cin == cout and stride == 1 else nn.Sequential(
            nn.Conv2d(cin, cout, 1, stride, bias=False), nn.BatchNorm2d(cout))
        self.relu = nn.ReLU()
    def forward(self, x): return self.relu(self.main(x) + self.shortcut(x))

class MiniResNet(nn.Module):
    def __init__(self, num_classes=43, width=32, blocks=(1, 1, 1, 1), dropout=.1):
        super().__init__()
        self.stem = nn.Sequential(nn.Conv2d(3, width, 3, 1, 1, bias=False),
                                  nn.BatchNorm2d(width), nn.ReLU())
        layers, cin = [], width
        for stage, n in enumerate(blocks):
            cout = width * 2**stage
            for b in range(n):
                layers.append(ResidualBlock(cin, cout, 2 if stage > 0 and b == 0 else 1))
                cin = cout
        self.body, self.pool = nn.Sequential(*layers), nn.AdaptiveAvgPool2d(1)
        self.head = nn.Sequential(nn.Dropout(dropout), nn.Linear(cin, num_classes))
    def forward(self, x): return self.head(self.pool(self.body(self.stem(x))).flatten(1))

config = dict(num_classes=43, width=32, blocks=list(BLOCKS), dropout=.1)
model = MiniResNet(**config).to(DEVICE)
print('Parameters:', sum(p.numel() for p in model.parameters()))
```

## Cell 6 — Train một epoch; AMP phải unscale trước khi clip

```python
# Cell 6 — Train một epoch; AMP phải unscale trước khi clip
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=WD)
scaler = torch.amp.GradScaler('cuda', enabled=AMP)

def train_epoch(model, dl):
    model.train()
    loss_sum, correct, count = 0., 0, 0
    for x, y in dl:
        x, y = x.to(DEVICE, non_blocking=True), y.to(DEVICE, non_blocking=True)
        optimizer.zero_grad(set_to_none=True)
        with torch.autocast(DEVICE.type, enabled=AMP):
            logits = model(x); loss = criterion(logits, y)
        if not torch.isfinite(loss): raise RuntimeError('Loss NaN/Inf')
        scaler.scale(loss).backward()
        scaler.unscale_(optimizer)
        nn.utils.clip_grad_norm_(model.parameters(), 5.)
        scaler.step(optimizer); scaler.update()
        loss_sum += loss.detach() * len(y)
        correct += (logits.detach().argmax(1) == y).sum()
        count += len(y)
    return loss_sum.item()/count, correct.item()/count
```

## Cell 7 — Inference và metric; shuffle=False giữ đúng thứ tự CSV

```python
# Cell 7 — Inference và metric; shuffle=False giữ đúng thứ tự CSV
@torch.inference_mode()
def probabilities(model, dl):
    model.eval()
    chunks = []
    for x, _ in dl:
        x = x.to(DEVICE, non_blocking=True)
        with torch.autocast(DEVICE.type, enabled=AMP): logits = model(x)
        chunks.append(logits.float().softmax(1).cpu())
    return torch.cat(chunks).numpy()

def score(probs):
    return float(f1_score(va.label, probs.argmax(1), labels=list(range(43)),
                          average='macro', zero_division=0))
```

## Cell 8 — Warmup + cosine; checkpoint theo Macro-F1

```python
# Cell 8 — Warmup + cosine; checkpoint theo Macro-F1
best_f1, history = -1., []
best_path = OUT / f'{RUN}_best.pt'
started = time.perf_counter()
for epoch in range(EPOCHS):
    tick = time.perf_counter()
    warmup = min(2, EPOCHS)
    factor = (epoch+1)/warmup if epoch < warmup else (
        .01 + .99 * (1 + math.cos(math.pi*(epoch-warmup+1)/(EPOCHS-warmup)))/2)
    for group in optimizer.param_groups: group['lr'] = LR * factor
    loss, acc = train_epoch(model, train_dl)
    probs = probabilities(model, valid_dl)
    f1 = score(probs)
    if not math.isfinite(f1): raise RuntimeError('Macro-F1 is not finite')
    seconds = time.perf_counter() - tick
    history.append(dict(epoch=epoch+1, loss=loss, train_acc=acc, val_f1=f1,
                        val_acc=float(accuracy_score(va.label, probs.argmax(1))),
                        lr=LR*factor, seconds=seconds))
    if f1 > best_f1:
        best_f1 = f1
        torch.save(dict(model_state={k:v.detach().cpu() for k,v in model.state_dict().items()},
                        model_config=config, image_size=SIZE, mean=mean, std=std,
                        best_f1=f1, best_epoch=epoch+1, seed=SEED, gamma=GAMMA, amp=AMP), best_path)
    pd.DataFrame(history).to_csv(OUT / f'{RUN}_history.csv', index=False)
    print(f'{epoch+1:02}/{EPOCHS} loss={loss:.4f} train={acc:.4f} '
          f'val_F1={f1:.5f} best={best_f1:.5f} {seconds:.1f}s')
print('Training + validation minutes:', (time.perf_counter()-started)/60)
```

## Cell 9 — Load lại best; tùy chọn so baseline cũ và ensemble 50/50

```python
# Cell 9 — Load lại best; tùy chọn so baseline cũ và ensemble 50/50
def restore(path):
    saved = torch.load(path, map_location='cpu', weights_only=True)
    net = MiniResNet(**saved['model_config']).to(DEVICE)
    net.load_state_dict(saved['model_state'])
    return net, saved

new, saved = restore(best_path)
p_new = probabilities(new, loader('validation', saved['image_size'], saved['mean'], saved['std']))
candidates = {'new': (p_new, [(new, saved)])}
if BASELINE_CKPT:
    old, old_saved = restore(BASELINE_CKPT)
    p_old = probabilities(old, loader('validation', old_saved['image_size'],
                                      old_saved['mean'], old_saved['std']))
    candidates['old'] = (p_old, [(old, old_saved)])
    candidates['ensemble'] = ((p_new+p_old)/2, [(new, saved), (old, old_saved)])
for name, (p, _) in candidates.items(): print(name, 'F1:', score(p))
chosen = max(candidates, key=lambda name: score(candidates[name][0]))
p_valid, members = candidates[chosen]
print('Selected:', chosen, 'accuracy:', accuracy_score(va.label, p_valid.argmax(1)))
```

## Cell 10 — Lưu bằng chứng để xem lỗi lớp 16/34

```python
# Cell 10 — Lưu bằng chứng để xem lỗi lớp 16/34
pred = p_valid.argmax(1)
report = pd.DataFrame(classification_report(va.label, pred, labels=list(range(43)),
                      output_dict=True, zero_division=0)).T
print(report.iloc[:43].sort_values('f1-score').head(10))
report.to_csv(OUT / f'{RUN}_{chosen}_classes.csv')
cm = confusion_matrix(va.label, pred, labels=list(range(43)))
pd.DataFrame(cm, index=range(43), columns=range(43)).to_csv(OUT / f'{RUN}_{chosen}_confusion.csv')
audit = va.copy(); audit['prediction'] = pred
top2 = np.argsort(p_valid, axis=1)[:, -2:]
audit['runner_up'] = top2[:, 0]
audit['prob_margin'] = np.sort(p_valid, axis=1)[:, -1] - np.sort(p_valid, axis=1)[:, -2]
audit.to_csv(OUT / f'{RUN}_{chosen}_validation.csv', index=False)
audit.loc[pred != va.label.to_numpy()].to_csv(OUT / f'{RUN}_{chosen}_errors.csv', index=False)
np.save(OUT / f'{RUN}_{chosen}_validation_probs.npy', p_valid)
(OUT / f'{RUN}_selection.json').write_text(json.dumps(dict(
    run=RUN, selected=chosen, macro_f1=score(p_valid),
    candidate_checkpoints=[str(best_path)] + ([BASELINE_CKPT] if BASELINE_CKPT else [])),
    indent=2), encoding='utf-8')
```

## Cell 11 — Xuất đủ hai CSV, dùng đúng preprocessing của từng checkpoint

```python
# Cell 11 — Xuất đủ hai CSV, dùng đúng preprocessing của từng checkpoint
def predict_split(split, members):
    total = None
    for net, ckpt in members:
        dl = loader(split, ckpt['image_size'], ckpt['mean'], ckpt['std'])
        p = probabilities(net, dl)
        total = p if total is None else total + p
    return (total / len(members)).argmax(1)

def write_submission(frame, pred, path, expected):
    assert len(frame) == len(pred) == expected
    sub = frame[['sample_id']].copy(); sub['label'] = np.asarray(pred, dtype=np.int64)
    assert sub.sample_id.is_unique and sub.label.between(0, 42).all()
    assert sub.sample_id.tolist() == frame.sample_id.tolist()
    sub.to_csv(path, index=False)
    check = pd.read_csv(path, dtype={'sample_id': str})
    assert list(check.columns) == ['sample_id', 'label']
    assert len(check) == expected and check.sample_id.tolist() == frame.sample_id.tolist()
    assert np.array_equal(check.label.to_numpy(), sub.label.to_numpy())
    print(path, check.shape)

for split, filename, expected in [('public_test', 'submission_public.csv', 4290),
                                  ('private_test', 'submission_private.csv', 4140)]:
    write_submission(frames[split], predict_split(split, members), OUT / filename, expected)
```

Cách thử: 64/CE/Gamma=False -> Gamma=True -> LR=5e-4 -> BLOCKS=(2,2,2,2), từng thay đổi.
Muốn so với 48 trong cùng code: SIZE=48 rồi Run All; AMP có thể làm khác baseline FP32 cũ.
Để cô lập resolution sát recipe cũ hơn, đặt AMP=False cho cả hai lượt 48/64.
BASELINE_CKPT chỉ dùng checkpoint tự train hợp lệ; code tự so single/ensemble trên validation.
EMA, STN, synthetic và TTA để sau; bản này giữ ngắn và dễ kiểm tra.
Chưa có benchmark GPU Kaggle của notebook mới; thời gian thực được in mỗi epoch.
Nguồn API: https://docs.pytorch.org/docs/stable/notes/amp_examples.html
Gamma: https://docs.pytorch.org/vision/stable/generated/torchvision.transforms.functional.adjust_gamma.html
