"use client";

import { useRef } from "react";

export type Sample = { label: string; text: string };

// Shared by every panel that offers seeded examples alongside free text (Known
// Pattern, Hunt Plan, Corpus Map). Examples are starting points, not the only
// supported input: samples get short scannable labels (not truncated prose),
// "+ Enter my own" clears the field and focuses it, and typing directly already
// deselects the active sample (via onSelectIndex(null) in onChange) -- both
// paths land in the same "custom" state.
export function ExamplePicker({
  label,
  samples,
  value,
  onChange,
  selectedIndex,
  onSelectIndex,
  rows = 4,
}: {
  label: string;
  samples: Sample[];
  value: string;
  onChange: (text: string) => void;
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function selectSample(i: number) {
    onChange(samples[i].text);
    onSelectIndex(i);
  }

  function enterOwn() {
    onChange("");
    onSelectIndex(null);
    textareaRef.current?.focus();
  }

  return (
    <div>
      <p className="text-xs font-medium text-muted mb-2">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {samples.map((s, i) => (
          <button
            key={s.label}
            onClick={() => selectSample(i)}
            className={`text-xs px-2.5 py-1.5 rounded border cursor-pointer transition-colors ${
              selectedIndex === i
                ? "border-accent bg-accent/15 text-accent"
                : "border-panel-border text-muted hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="text-xs text-muted">or</span>
        <button
          onClick={enterOwn}
          className="text-xs px-2.5 py-1.5 rounded-full border border-accent/50 text-accent hover:bg-accent/10 cursor-pointer transition-colors"
        >
          + Enter my own
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onSelectIndex(null);
        }}
        rows={rows}
        className="w-full bg-black/30 border border-panel-border rounded px-3 py-2 text-sm"
      />
    </div>
  );
}
