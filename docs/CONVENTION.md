# Link a repo into githfield

githfield is the **product-management field** for the knitweb ecosystem: it
aggregates every field's **docs** and **backlog** into one public board
([githfield.github.io](https://githfield.github.io)) and a GitHub Project.

Linking a repo is **one file**: drop a `githfield.yml` in its root. The harvester
scans the configured orgs (`config.json`) twice an hour, picks up any repo that
has the manifest, and the repo appears on the board — **no site-code change**.

## The manifest — `githfield.yml`

```yaml
# githfield.yml — links this repo's docs & backlog into githfield
field:   molgang                 # which knitweb field this repo belongs to
name:    MOLGANG                 # display name on the board
accent:  "#f4b41a"               # field colour (hex)
summary: P2P chemistry game on the Knitweb
homepage: https://molgang.knitweb.art        # optional
project:  https://github.com/orgs/Knitweb/projects/1   # optional PM project
backlog:
  labels: []                     # [] = all open issues; or e.g. [agent, "prio:high"]
  group_by: "prio:"              # bucket cards by this label prefix ("" = flat)
docs:
  - { title: "Architecture", path: "docs/ARCHITECTURE.md", stage: reference }
  - { title: "Roadmap",      path: "docs/ROADMAP.md",      stage: roadmap }
```

### Fields

| key | required | meaning |
|---|---|---|
| `field` | ✓ | field slug this repo belongs to (chemfield, molgang, …) |
| `name` | ✓ | display name |
| `accent` | ✓ | `#rrggbb` colour for the field's cards |
| `summary` | – | one-line description |
| `homepage` / `project` | – | links shown on the field card |
| `backlog.labels` | – | which issue labels count as backlog (`[]` = all open issues) |
| `backlog.group_by` | – | label **prefix** to bucket cards; matches each field's own scheme (`nacht-`, `prio:`, `area:`, …). `""` or omitted = flat |
| `docs[]` | – | `{ title, path, stage }` — `path` is **linked in place** (never copied), resolved to `github.com/<repo>/blob/<default-branch>/<path>` |

### What the board shows

- **Fields** — a card per field with open/done/docs counts and links.
- **Backlog** — open issues per field, bucketed by `group_by`, with
  queued / ⟳ review / ✓ done status (review = an open PR whose title or branch
  references the issue number). Closed issues are collapsed under "N done".
- **Docs** — the declared docs per field, linked to where they live, with a
  `stage` badge.

## Notes

- Public repos need no token to be read by the harvester (it runs authenticated
  in CI). To include **private** repos, an owner adds a `GITHFIELD_PAT` secret.
- To add your repo's org to the scan, add it to `config.json` → `orgs`.
- Nothing is moved or duplicated — githfield only **links** to docs and issues
  where they already live.
