# justif 0.6.1 → 0.9.1 compare set

Labeled side-by-sides (left 0.6.1, right 0.9.1) live in `side-by-side/`.
Raw captures are in `before/` and `after/`. Notes are in `OBSERVED.md`.

Regenerate (needs a local preview on :4321):

```bash
node notes/justif-0.9.1-compare/capture.mjs --label before --base http://127.0.0.1:4321
# bump justif, rebuild, restart preview
node notes/justif-0.9.1-compare/capture.mjs --label after --base http://127.0.0.1:4321
node notes/justif-0.9.1-compare/compose.mjs
```
