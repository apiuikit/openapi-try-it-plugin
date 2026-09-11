---
"@apiuikit/openapi-try-it-plugin": patch
---

Fix the "Try it" row's chrome (border, background) following the wrong palette when a host sets `theme.mode` (apiuikit ^1.9.0). `tryItRowStyle` previously guessed which of `theme.light`/`theme.dark` was active with `theme?.light ?? theme?.dark` — correct only for the old "light wins if both set" rule. It now reads `useDocumentContext().resolvedMode`, apiuikit's own answer, so the row stays visually consistent whenever `mode` picks dark (or `"system"` resolves to dark) while both palettes are configured. Requires apiuikit ^1.10.0 or later — the first version exposing `resolvedMode` (not 1.9.0, which shipped `theme.mode` itself but not this field).
