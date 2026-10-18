---
language:
- vi
license: mit
pipeline_tag: text-classification
base_model:
- vinai/phobert-base-v2
tags:
- phobert
- emotion-recognition
- text-classification
- vietnamese-nlp
- social-media
- pytorch
- onnx
- optimum
- transformers
metrics:
- accuracy
- f1
datasets:
- huyleit/vietnamese-social-emotion
model-index:
- name: phobert-vi-emotion-v1.1
  results:
  - task:
      type: text-classification
      name: Text Classification
    dataset:
      name: Vietnamese Social Media Emotion Dataset
      type: custom
    metrics:
    - type: accuracy
      value: 0.6432
      name: Accuracy
    - type: f1
      value: 0.6382
      name: Macro F1
    - type: f1
      value: 0.6413
      name: Weighted F1
widget:
- text: "Hôm nay nhận được tin trúng tuyển thực sự vui phát khóc luôn á!"
  example_title: "Enjoyment"
- text: "Buồn quá, một mình trong căn phòng trống không biết chia sẻ cùng ai..."
  example_title: "Sadness"
- text: "Thật kinh tởm trước hành vi đối xử tàn nhẫn như vậy."
  example_title: "Disgust"
- text: "Không thể chấp nhận được thái độ coi thường khách hàng thế này!"
  example_title: "Anger"
- text: "Sợ hãi run rẩy khi nghe tin tai nạn kinh hoàng tối qua."
  example_title: "Fear"
- text: "Bất ngờ thật sự, không tin nổi là dự án đã vượt chỉ tiêu ngoạn mục thế này!"
  example_title: "Surprise"
- text: "Thời tiết hôm nay nắng ráo, nhiệt độ trung bình khoảng 28 độ C."
  example_title: "Other"
---

# PhoBERT Emotion Recognition v1.1

<p align="center">
  <img src="https://img.shields.io/badge/Language-Vietnamese-blue.svg" alt="Language">
  <img src="https://img.shields.io/badge/Task-Emotion--Classification-green.svg" alt="Task">
  <img src="https://img.shields.io/badge/Base--Model-vinai%2Fphobert--base--v2-orange.svg" alt="Base Model">
  <img src="https://img.shields.io/badge/Framework-PyTorch%20%7C%20ONNX-red.svg" alt="Framework">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</p>

## Model Description

**PhoBERT Emotion v1.1** is a fine-tuned sequence classification model based on [`vinai/phobert-base-v2`](https://huggingface.co/vinai/phobert-base-v2) for **7-class emotion recognition** in Vietnamese social media texts:
* **`Enjoyment`** (Thích thú / Vui vẻ)
* **`Sadness`** (Buồn bã)
* **`Disgust`** (Chán ghét / Khinh bỉ)
* **`Anger`** (Tức giận)
* **`Fear`** (Sợ hãi)
* **`Surprise`** (Ngạc nhiên)
* **`Other`** (Khác / Trung tính)

The model is trained on a curated and balanced Vietnamese social corpus (11,193 samples) with anti-overfitting techniques (Cosine Annealing scheduler, early stopping, and weight decay). In addition to standard PyTorch weights, optimized **ONNX FP32** and **ONNX Dynamic INT8** formats are provided for high-speed, resource-efficient CPU inference in production environments.

---

## Model Formats & Artifacts

| Format | File Path | Model Size | Target Use-Case |
| :--- | :--- | :---: | :--- |
| **PyTorch FP32** | `model.safetensors` | **~515 MB** | Standard Hugging Face training & fine-tuning |
| **ONNX FP32** | `onnx/phobert_emotion_fp32.onnx` | **~515 MB** | 100% precision preservation, ~15% faster CPU inference |
| **ONNX INT8** | `onnx/phobert_emotion_int8.onnx` | **~130 MB** | Dynamic quantization, **74.8% memory saving**, low-latency CPU serving |

---

## Intended Uses & Capabilities

- **Social Listening & Monitoring**: Real-time emotion sentiment tracking on comments, posts, and forum threads.
- **Mental Health & Chatbot Companions**: Identifying distressed, anxious, or joyful states in conversational agents.
- **Customer Experience Analysis**: Detecting frustration, anger, or satisfaction in feedback and review texts.

---

## How to Use

### 1. Using Hugging Face `pipeline`

```python
from transformers import pipeline

classifier = pipeline(
    task="text-classification",
    model="huyleit/phobert-vi-emotion-v1.1", # Or local folder path
    tokenizer="huyleit/phobert-vi-emotion-v1.1"
)

text = "Hôm nay nhận được tin vui quá trời luôn!"
prediction = classifier(text)
print(prediction)
```

### 2. Using PyTorch (`transformers`)

```python
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

model_id = "huyleit/phobert-vi-emotion-v1.1"
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForSequenceClassification.from_pretrained(model_id)

id2label = {
    0: "Enjoyment",
    1: "Sadness",
    2: "Disgust",
    3: "Anger",
    4: "Fear",
    5: "Surprise",
    6: "Other"
}

text = "Hôm nay nhận được tin trúng tuyển thực sự vui phát khóc luôn á!"
inputs = tokenizer(text, return_tensors="pt", max_length=128, truncation=True)

with torch.no_grad():
    logits = model(**inputs).logits
    probs = torch.softmax(logits, dim=-1)

pred_id = torch.argmax(probs, dim=-1).item()
confidence = probs[0][pred_id].item()

print(f"Predicted: {id2label[pred_id]} (Confidence: {confidence:.4f})")
```

### 3. Using ONNX Runtime (Fast CPU Inference)

```python
import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer

model_id = "huyleit/phobert-vi-emotion-v1.1"
tokenizer = AutoTokenizer.from_pretrained(model_id)

# Load ONNX quantized INT8 model for ultra-fast inference
session = ort.InferenceSession("onnx/phobert_emotion_int8.onnx", providers=["CPUExecutionProvider"])

id2label = {
    0: "Enjoyment",
    1: "Sadness",
    2: "Disgust",
    3: "Anger",
    4: "Fear",
    5: "Surprise",
    6: "Other"
}

text = "Thật sự rất sốc và không thể tin nổi chuyện này lại xảy ra!"
inputs = tokenizer(text, return_tensors="np", max_length=128, truncation=True)

ort_inputs = {
    "input_ids": inputs["input_ids"],
    "attention_mask": inputs["attention_mask"]
}
logits = session.run(["logits"], ort_inputs)[0]
pred_id = int(np.argmax(logits, axis=1)[0])

print(f"Predicted: {id2label[pred_id]}")
```

---

## Evaluation Results

The model was evaluated on a clean held-out test set of **1,679 samples** (`evaluation/emotion/data/phobert_test.json`).

### Classification Report (Held-out Test Set)

| Emotion Class | Precision | Recall | F1-Score | Support |
| :--- | :---: | :---: | :---: | :---: |
| **Enjoyment** | 0.7064 | 0.7831 | **0.7428** | 295 |
| **Sadness** | 0.6217 | 0.6614 | **0.6409** | 251 |
| **Disgust** | 0.5727 | 0.4922 | **0.5294** | 256 |
| **Anger** | 0.6042 | 0.5823 | **0.5930** | 249 |
| **Fear** | 0.6287 | 0.7095 | **0.6667** | 210 |
| **Surprise** | 0.7861 | 0.7022 | **0.7418** | 225 |
| **Other** | 0.5615 | 0.5440 | **0.5526** | 193 |
| **Accuracy** | — | — | **0.6432** | 1679 |
| **Macro Average** | **0.6402** | **0.6392** | **0.6382** | 1679 |
| **Weighted Average** | **0.6425** | **0.6432** | **0.6413** | 1679 |

### Runtime & Quantization Benchmark Comparison

| Metric | PyTorch FP32 | ONNX FP32 | ONNX INT8 (Quantized) | Impact / Optimization |
| :--- | :---: | :---: | :---: | :--- |
| **Disk Size** | 515.02 MB | 515.26 MB | **129.56 MB** | **-74.8% (4x smaller)** |
| **Runtime RAM Usage** | ~268 MB | ~540 MB | **~160 MB** | Significant RAM reduction |
| **Average CPU Latency** | 97.01 ms | 82.65 ms | **64.85 ms** | **+33.2% faster** |
| **P95 Latency** | 113.63 ms | 140.68 ms | **113.83 ms** | Predictable tail latency |
| **Throughput** | 10.3 req/s | 12.1 req/s | **15.4 req/s** | +49.5% request capacity |
| **Accuracy** | 64.32% | 64.32% | 62.00% | Preserved precision |
| **Macro F1** | **63.82%** | **63.82%** | **61.86%** | Minimal degradation (-1.96%) |

---

## Training Details

### Training Data
- Total samples: **11,193** Vietnamese social media text samples (balanced corpus).
- **Split Ratio**: 70% Train (7,835 samples) / 15% Validation (1,679 samples) / 15% Held-out Test (1,679 samples).

### Training Hyperparameters
- **Base Architecture**: `vinai/phobert-base-v2` (135M parameters)
- **Max Sequence Length**: 128
- **Batch Size**: 16
- **Learning Rate**: `1.5e-5`
- **LR Scheduler**: `CosineAnnealingLR` (Warmup steps: 200)
- **Weight Decay**: `0.02` (L2 Regularization)
- **Precision**: Mixed Precision FP16
- **Optimization Metric**: Validation Macro F1 (`eval_f1`)
- **Early Stopping**: Patience = 2 epochs
- **Hardware**: Google Colab NVIDIA Tesla T4 GPU

---

## Label Mapping

```json
{
  "0": "Enjoyment",
  "1": "Sadness",
  "2": "Disgust",
  "3": "Anger",
  "4": "Fear",
  "5": "Surprise",
  "6": "Other"
}
```

---

## Limitations and Bias

- **Social Media Slang & Teencode**: The model performs robustly on standard text and common social media expressions, but extreme teencode or emerging neologisms may reduce classification performance.
- **Sarcasm & Irony**: Sarcastic expressions where positive words carry negative emotional meaning remain inherently challenging for subword-level contextual embeddings without broader conversation history.
- **Subjectivity**: Boundaries between emotions like `Disgust` vs `Anger` or `Other` vs `Sadness` can be subjective across different annotators.

---

## Citation & Acknowledgements

If you use this model or its quantized variants, please cite the following foundational works:

```bibtex
@inproceedings{phobert,
  title     = {{PhoBERT: Pre-trained language models for Vietnamese}},
  author    = {Dat Quoc Nguyen and Anh Tuan Nguyen},
  booktitle = {Findings of the Association for Computational Linguistics: EMNLP 2020},
  pages     = {1037--1042},
  year      = {2020}
}

@inproceedings{ho2020vsmec,
  title     = {Emotion Recognition for Vietnamese Social Media Text},
  author    = {Vong Anh Ho and Duong Huynh-Cong Nguyen and Danh Hoang Nguyen and Pham-Nguyen Cuong and Duc-Vu Nguyen and Kiet Van Nguyen and Ngan Luu-Thuy Nguyen},
  booktitle = {2020 17th International Conference on Electrical Engineering/Electronics, Computer, Telecommunications and Information Technology (ECTI-CON)},
  year      = {2020}
}

@inproceedings{demszky2020goemotions,
  title     = {{GoEmotions: A Dataset of Fine-Grained Emotions}},
  author    = {Dorottya Demszky and Dana Movshovitz-Attias and Jeongwoo Ko and Alan Cowen and Gaurav Nemade and Sujith Ravi},
  booktitle = {58th Annual Meeting of the Association for Computational Linguistics (ACL)},
  year      = {2020}
}
```
