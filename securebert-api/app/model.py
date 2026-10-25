"""
SecureBERT2.0 embedding wrapper -- quantized ONNX runtime, not torch.

The original torch + fp32 weights pushed Render's free-tier instance (512MB
RAM) into repeated OOM kills in production. This loads a dynamically
int8-quantized ONNX export instead (see scripts/export_onnx.py for how it was
built): no torch import at runtime, ~150MB weights instead of ~600MB fp32,
and onnxruntime's own footprint is much smaller than torch's.

The HF model card for cisco-ai/SecureBERT2.0-base only documents
AutoModelForMaskedLM (fill-mask). For embeddings we use the base encoder and
mean-pool last_hidden_state, weighted by the attention mask -- see
docs/prototypes/securebert-aia-correlation.md.
"""
import os
import threading
from pathlib import Path

import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer

MODEL_NAME = os.environ.get("SECUREBERT_MODEL", "cisco-ai/SecureBERT2.0-base")

ROOT = Path(__file__).resolve().parent.parent
ONNX_PATH = ROOT / "data" / "model_onnx" / "model_int8.onnx"
TOKENIZER_DIR = ROOT / "data" / "model_onnx" / "tokenizer"

_lock = threading.Lock()
_tokenizer = None
_session = None


def _load():
    global _tokenizer, _session
    if _session is not None:
        return _tokenizer, _session
    with _lock:
        if _session is None:
            _tokenizer = AutoTokenizer.from_pretrained(str(TOKENIZER_DIR))
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 1
            opts.inter_op_num_threads = 1
            _session = ort.InferenceSession(
                str(ONNX_PATH), sess_options=opts, providers=["CPUExecutionProvider"]
            )
    return _tokenizer, _session


def is_loaded() -> bool:
    return _session is not None


def embed(text: str) -> list[float]:
    tokenizer, session = _load()
    enc = tokenizer(text, return_tensors="np", truncation=True, max_length=1024)
    feed = {k: v for k, v in enc.items() if k in {i.name for i in session.get_inputs()}}
    hidden = session.run(None, feed)[0]
    mask = enc["attention_mask"][..., None]
    vec = (hidden * mask).sum(1) / np.clip(mask.sum(1), 1, None)
    return vec.squeeze(0).tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    return [embed(t) for t in texts]
