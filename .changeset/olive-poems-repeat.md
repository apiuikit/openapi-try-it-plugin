---
"@apiuikit/openapi-try-it-plugin": minor
---

Make the "Try it" panel usable on small screens. Below 768px the modal fills the viewport instead of sitting inside a 2rem inset, its request and response columns stack into a single scrolling column (same order as the tab layout, with `Send` sticky at the bottom), and the panel scrolls to the response once one arrives. Multipart body rows wrap rather than squeezing the value field, and all fields render at 16px on a narrow viewport so iOS Safari doesn't zoom in on focus. Layouts at 768px and above are unchanged.
