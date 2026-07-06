# githfield.github.io

The **githfield** board — one place for the docs and backlog of every field in
the KnitWeb ecosystem. Live at **https://githfield.github.io**.

Each repo self-declares its docs + backlog in a root `githfield.yml`; the
harvester (`scripts/harvest.mjs`, run by `.github/workflows/harvest.yml`) scans
the orgs in `config.json`, builds `catalog.json`, and the static `index.html`
renders three views: **Fields · Backlog · Docs**.

- **Link a repo:** [`docs/CONVENTION.md`](docs/CONVENTION.md) — drop one file, no site change.
- **Build locally:** `npm install && GITHUB_TOKEN=$(gh auth token) npm run harvest`, then serve the folder.

Docs are linked in place; backlog is live GitHub issues. Reputation-free product
management for the hub-and-fields ecosystem (chemfield · molgang · knitweb · …).
