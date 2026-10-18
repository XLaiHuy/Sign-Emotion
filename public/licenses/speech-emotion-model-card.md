---
license: apache-2.0
datasets:
- stapesai/ssi-speech-emotion-recognition
language:
- en
base_model:
- facebook/wav2vec2-base-960h
pipeline_tag: audio-classification
library_name: transformers
tags:
- emotion
- audio
- classification
- music
- facebook
---

![1.png](https://cdn-uploads.huggingface.co/production/uploads/65bb837dbfb878f46c77de4c/J4EOXVmr-bBtxeykZTWbc.png)

# Speech-Emotion-Classification

> **Speech-Emotion-Classification** is a fine-tuned version of `facebook/wav2vec2-base-960h` for **multi-class audio classification**, specifically trained to detect **emotions** in speech. This model utilizes the `Wav2Vec2ForSequenceClassification` architecture to accurately classify speaker emotions from audio signals.

> \[!note]
> Wav2Vec2: Self-Supervised Learning for Speech Recognition
> [https://arxiv.org/pdf/2006.11477](https://arxiv.org/pdf/2006.11477)


```py
Classification Report:

              precision    recall  f1-score   test_support

       Anger       0.8314    0.9346    0.8800       306
        Calm       0.7949    0.8857    0.8378        35
     Disgust       0.8261    0.8287    0.8274       321
        Fear       0.8303    0.7377    0.7812       305
       Happy       0.8929    0.7764    0.8306       322
     Neutral       0.8423    0.9303    0.8841       287
         Sad       0.7749    0.7825    0.7787       308
  Surprised       0.9478    0.9478    0.9478       115

    accuracy                           0.8379      1999
   macro avg       0.8426    0.8530    0.8460      1999
weighted avg       0.8392    0.8379    0.8367      1999
```

![download.png](https://cdn-uploads.huggingface.co/production/uploads/65bb837dbfb878f46c77de4c/oW8Qa6MO2koMOhRQgVd6a.png)

![download (1).png](https://cdn-uploads.huggingface.co/production/uploads/65bb837dbfb878f46c77de4c/w_wC5gmrWhNlPYS_ftYSC.png)

---

## Label Space: 8 Classes

```
Class 0: Anger  
Class 1: Calm  
Class 2: Disgust  
Class 3: Fear  
Class 4: Happy  
Class 5: Neutral  
Class 6: Sad  
Class 7: Surprised
```

---

## Install Dependencies

```bash
pip install gradio transformers torch librosa hf_xet
```

---

## Inference Code

```python
import gradio as gr
from transformers import Wav2Vec2ForSequenceClassification, Wav2Vec2FeatureExtractor
import torch
import librosa

# Load model and processor
model_name = "prithivMLmods/Speech-Emotion-Classification"
model = Wav2Vec2ForSequenceClassification.from_pretrained(model_name)
processor = Wav2Vec2FeatureExtractor.from_pretrained(model_name)

# Label mapping
id2label = {
    "0": "Anger",
    "1": "Calm",
    "2": "Disgust",
    "3": "Fear",
    "4": "Happy",
    "5": "Neutral",
    "6": "Sad",
    "7": "Surprised"
}

def classify_audio(audio_path):
    # Load and resample audio to 16kHz
    speech, sample_rate = librosa.load(audio_path, sr=16000)

    # Process audio
    inputs = processor(
        speech,
        sampling_rate=sample_rate,
        return_tensors="pt",
        padding=True
    )

    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probs = torch.nn.functional.softmax(logits, dim=1).squeeze().tolist()

    prediction = {
        id2label[str(i)]: round(probs[i], 3) for i in range(len(probs))
    }

    return prediction

# Gradio Interface
iface = gr.Interface(
    fn=classify_audio,
    inputs=gr.Audio(type="filepath", label="Upload Audio (WAV, MP3, etc.)"),
    outputs=gr.Label(num_top_classes=8, label="Emotion Classification"),
    title="Speech Emotion Classification",
    description="Upload an audio clip to classify the speaker's emotion from voice signals."
)

if __name__ == "__main__":
    iface.launch()
```

---



## Original Label

```py
  "id2label": {
    "0": "ANG",
    "1": "CAL",
    "2": "DIS",
    "3": "FEA",
    "4": "HAP",
    "5": "NEU",
    "6": "SAD",
    "7": "SUR"
  },
```

--- 

## Intended Use

`Speech-Emotion-Classification` is designed for:

* **Speech Emotion Analytics** – Analyze speaker emotions in call centers, interviews, or therapeutic sessions.
* **Conversational AI Personalization** – Adjust voice assistant responses based on detected emotion.
* **Mental Health Monitoring** – Support emotion recognition in voice-based wellness or teletherapy apps.
* **Voice Dataset Curation** – Tag or filter speech datasets by emotion for research or model training. 
* **Media Annotation** – Automatically annotate podcasts, audiobooks, or videos with speaker emotion metadata.