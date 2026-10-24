"""
SecureBERT2.0 embedding wrapper.

The HF model card for cisco-ai/SecureBERT2.0-base only documents AutoModelForMaskedLM
(fill-mask). For embeddings we use the base encoder and mean-pool last_hidden_state,
weighted by the attention mask -- see docs/prototypes/securebert-aia-correlation.md.
"""
import os
import threading
import torch
from transformers import AutoModel, AutoTokenizer

MODEL_NAME = os.environ.get("SECUREBERT_MODEL", "cisco-ai/SecureBERT2.0-base")

_lock = threading.Lock()
_tokenizer = None
_model = None


def _load():
    global _tokenizer, _model
    if _model is not None:
        return _tokenizer, _model
    with _lock:
        if _model is None:
            _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
            _model = AutoModel.from_pretrained(MODEL_NAME)
            _model.eval()
    return _tokenizer, _model


def is_loaded() -> bool:
    return _model is not None


@torch.no_grad()
def embed(text: str) -> list[float]:
    tokenizer, model = _load()
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=1024)
    hidden = model(**inputs).last_hidden_state
    mask = inputs["attention_mask"].unsqueeze(-1)
    vec = (hidden * mask).sum(1) / mask.sum(1).clamp(min=1)
    return vec.squeeze(0).tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    return [embed(t) for t in texts]
