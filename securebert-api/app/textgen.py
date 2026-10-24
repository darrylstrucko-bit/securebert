"""
Builds the plain-text alert fragments that get embedded, identically for real
case alerts and synthetic noise, so they're always being compared like with like.
Case-level vectors are derived as the mean of a case's own alert vectors (see
build_embeddings.py) rather than a separate long-document embed.
"""


def alert_text(alert: dict) -> str:
    parts = [alert.get("title", ""), alert.get("description", ""), alert.get("why_it_matters", "")]
    return " ".join(p for p in parts if p)
