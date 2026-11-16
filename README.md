# VR180 Studio

Edit multiple VR180 source clips into a single YouTube-ready video.

Successor to `vr180-quick-editor` (Flask + MoviePy). Architecture, component
library (`public/js/custom-ui/`) and development pipeline are carried over from
AnyTale: Express 5 server with domain features under `server/features/`, a
Preact + htm + goober client with no build step, and Kanban Lite cards under
`.kanban/` driven by the skills in `.claude/skills/`.

## Setup

```bash
npm install
npm run libs     # vendors preact/htm/goober/boxicons + fonts into public/
npm start        # http://localhost:3180
npm run kanban   # board on http://localhost:2956
```
