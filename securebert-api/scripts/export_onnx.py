"""
One-time, offline step: export cisco-ai/SecureBERT2.0-base to ONNX, then
dynamically quantize it to int8. Needs torch + transformers installed locally
(dev-only -- NOT in requirements.txt, since the whole point is Render's
runtime never imports torch).

Run from securebert-api/: python scripts/export_onnx.py

Writes:
  data/model_onnx/model.onnx       -- fp32 ONNX graph (intermediate, not deployed)
  data/model_onnx/model_int8.onnx  -- dynamically-quantized int8 graph (deployed)
  data/model_onnx/tokenizer/       -- tokenizer files (deployed alongside)
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402
import torch  # noqa: E402
from transformers import AutoModel, AutoTokenizer  # noqa: E402

from app.model import MODEL_NAME  # noqa: E402

OUT_DIR = ROOT / "data" / "model_onnx"
FP32_PATH = OUT_DIR / "model.onnx"
INT8_PATH = OUT_DIR / "model_int8.onnx"
TOKENIZER_DIR = OUT_DIR / "tokenizer"


def export_fp32():
    print(f"Loading {MODEL_NAME} (torch)...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModel.from_pretrained(MODEL_NAME)
    model.eval()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tokenizer.save_pretrained(TOKENIZER_DIR)

    dummy = tokenizer("export dummy input for onnx tracing", return_tensors="pt")
    input_names = list(dummy.keys())
    dynamic_axes = {name: {0: "batch", 1: "sequence"} for name in input_names}
    dynamic_axes["last_hidden_state"] = {0: "batch", 1: "sequence"}

    print(f"Exporting to {FP32_PATH} ...")
    torch.onnx.export(
        model,
        tuple(dummy[name] for name in input_names),
        str(FP32_PATH),
        input_names=input_names,
        output_names=["last_hidden_state"],
        dynamic_axes=dynamic_axes,
        opset_version=17,
        dynamo=False,
    )
    print("fp32 export done.")
    return tokenizer, model, dummy


def quantize():
    from onnxruntime.quantization import quantize_dynamic, QuantType

    print(f"Quantizing to int8 -> {INT8_PATH} ...")
    quantize_dynamic(
        str(FP32_PATH),
        str(INT8_PATH),
        weight_type=QuantType.QInt8,
        per_channel=True,
        reduce_range=True,
    )
    print("quantization done.")


def sanity_check(tokenizer, torch_model, dummy):
    import onnxruntime as ort

    texts = [
        "Indirect prompt injection used to exfiltrate ticket data via an ops copilot.",
        "LOTL PowerShell credential theft and lateral movement over SMB.",
        "Routine patch notification, no action needed.",
    ]

    sess_fp32 = ort.InferenceSession(str(FP32_PATH))
    sess_int8 = ort.InferenceSession(str(INT8_PATH))

    with torch.no_grad():
        torch_out = torch_model(**dummy).last_hidden_state.numpy()
    onnx_fp32_out = sess_fp32.run(None, {k: v.numpy() for k, v in dummy.items()})[0]
    diff = np.abs(torch_out - onnx_fp32_out).max()
    print(f"torch vs onnx-fp32 max abs diff (dummy input): {diff:.6f}")

    def mean_pool(hidden, mask):
        mask = mask[..., None]
        return (hidden * mask).sum(1) / np.clip(mask.sum(1), 1, None)

    print("\nCosine similarity, fp32 ONNX vs int8 ONNX, per sample text:")
    for text in texts:
        enc = tokenizer(text, return_tensors="np", truncation=True, max_length=1024)
        feed = {k: v for k, v in enc.items()}
        h_fp32 = sess_fp32.run(None, feed)[0]
        h_int8 = sess_int8.run(None, feed)[0]
        v_fp32 = mean_pool(h_fp32, enc["attention_mask"])[0]
        v_int8 = mean_pool(h_int8, enc["attention_mask"])[0]
        cos = float(np.dot(v_fp32, v_int8) / (np.linalg.norm(v_fp32) * np.linalg.norm(v_int8) + 1e-9))
        print(f"  {cos:.5f}  {text[:60]}")

    fp32_size = FP32_PATH.stat().st_size / 1e6
    int8_size = INT8_PATH.stat().st_size / 1e6
    print(f"\nfp32 onnx size: {fp32_size:.1f} MB, int8 onnx size: {int8_size:.1f} MB")


def main():
    tokenizer, model, dummy = export_fp32()
    quantize()
    sanity_check(tokenizer, model, dummy)
    print(f"\nDone. Deploy: {INT8_PATH} + {TOKENIZER_DIR}")
    print(f"(fp32 intermediate at {FP32_PATH} can be deleted before committing.)")


if __name__ == "__main__":
    main()
