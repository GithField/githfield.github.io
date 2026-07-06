#!/usr/bin/env node
// githfield harvester — builds catalog.json from every repo that carries a
// githfield.yml manifest. Enumerates the orgs in config.json, reads each repo's
// manifest (contents API), pulls its issues + open PRs, and emits a catalog the
// static board renders. Authenticated (GITHUB_TOKEN / GH_TOKEN) → 5000 req/hr,
// so it avoids the anonymous 60/hr limit the client-side chemfield board hits.
//
// Reuses the chemfield.github.io aggregation logic (goal extraction, PR↔issue
// linking, status), generalized from 2 hardcoded repos to N manifest repos.

import { readFileSync, writeFileSync } from "node:fs";
import yaml from "js-yaml";

const API = "https://api.github.com";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const cfg = JSON.parse(readFileSync(new URL("../config.json", import.meta.url)));

async function gh(path, { raw = false } = {}) {
  const r = await fetch(path.startsWith("http") ? path : API + path, {
    headers: {
      Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      "User-Agent": "githfield-harvester",
    },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${r.status} ${path} — ${(await r.text()).slice(0, 200)}`);
  return raw ? r.text() : r.json();
}

// --- reused chemfield.github.io helpers, generalized ------------------------
const goalOf = (body) => {
  if (!body) return "";
  const m = body.match(/\*\*(?:DOEL|GOAL):\*\*\s*([^\n]+)/i);
  if (m) return m[1].trim();
  // fall back to the first non-heading, non-empty line
  const line = body.split("\n").map((s) => s.trim())
    .find((s) => s && !s.startsWith("#") && !s.startsWith("<!--"));
  return line ? line.replace(/[*_`]/g, "").slice(0, 140) : "";
};
const idFromText = (s) => {
  const kw = (s || "").match(/(?:KW|LEAD)?[-\s#]?0*(\d+)/i); // KW-000N / #N / N
  return kw ? Number(kw[1]) : null;
};

async function listRepos(org) {
  const out = [];
  for (let page = 1; page <= 4; page++) {
    const rows = await gh(`/orgs/${org}/repos?per_page=100&type=all&page=${page}`);
    if (!rows || !rows.length) break;
    out.push(...rows.filter((r) => !r.archived));
    if (rows.length < 100) break;
  }
  return out;
}

async function manifest(fullName, branch) {
  const raw = await gh(`/repos/${fullName}/contents/${cfg.manifest}?ref=${branch}`, { raw: true });
  if (!raw) return null;
  try { return yaml.load(raw); } catch (e) { console.warn(`  bad manifest in ${fullName}: ${e.message}`); return null; }
}

async function issuesAndPrs(fullName) {
  const issues = [];
  for (let page = 1; page <= 5; page++) {
    const rows = await gh(`/repos/${fullName}/issues?state=all&per_page=100&page=${page}`);
    if (!rows || !rows.length) break;
    issues.push(...rows.filter((i) => !i.pull_request));
    if (rows.length < 100) break;
  }
  const prs = (await gh(`/repos/${fullName}/pulls?state=open&per_page=100`)) || [];
  return { issues, prs };
}

function backlogFor(m, issues, prs) {
  const wantLabels = (m.backlog?.labels) || [];
  const sel = issues.filter((i) =>
    !wantLabels.length || i.labels.some((l) => wantLabels.includes(l.name)));
  // map open PRs to issues by parsed id (title or branch), chemfield-style
  const prByIssue = new Map();
  for (const pr of prs) {
    const n = idFromText(pr.title) ?? idFromText(pr.head?.ref);
    if (n != null && !prByIssue.has(n)) prByIssue.set(n, pr);
  }
  return sel.map((i) => {
    const pr = prByIssue.get(i.number);
    const status = i.state === "closed" ? "done" : pr ? "review" : "queued";
    return {
      number: i.number, title: i.title, url: i.html_url, state: i.state,
      labels: i.labels.map((l) => l.name), goal: goalOf(i.body), status,
      pr: pr ? { number: pr.number, url: pr.html_url } : null,
    };
  }).sort((a, b) => a.number - b.number);
}

function docsFor(m, fullName, branch) {
  return (m.docs || []).map((d) => ({
    title: d.title || d.path,
    stage: d.stage || "",
    url: `https://github.com/${fullName}/blob/${branch}/${d.path}`,
    path: d.path,
  }));
}

const main = async () => {
  const fields = [];
  for (const org of cfg.orgs) {
    console.log(`scanning ${org}…`);
    let repos = [];
    try { repos = await listRepos(org); }
    catch (e) { console.warn(`  cannot list ${org}: ${e.message}`); continue; }
    for (const repo of repos) {
      const m = await manifest(repo.full_name, repo.default_branch);
      if (!m) continue;
      console.log(`  ✓ ${repo.full_name} (field: ${m.field || "?"})`);
      const { issues, prs } = await issuesAndPrs(repo.full_name);
      const backlog = backlogFor(m, issues, prs);
      fields.push({
        field: m.field || repo.name,
        name: m.name || repo.name,
        accent: m.accent || "#3fb6a8",
        summary: m.summary || repo.description || "",
        homepage: m.homepage || "",
        project: m.project || "",
        repo: repo.full_name,
        group_by: m.backlog?.group_by || "",
        docs: docsFor(m, repo.full_name, repo.default_branch),
        backlog,
        counts: {
          docs: (m.docs || []).length,
          open: backlog.filter((b) => b.state === "open").length,
          review: backlog.filter((b) => b.status === "review").length,
          done: backlog.filter((b) => b.state === "closed").length,
        },
      });
    }
  }
  fields.sort((a, b) => a.field.localeCompare(b.field));
  const catalog = { generated: new Date().toISOString(), fieldCount: fields.length, fields };
  writeFileSync(new URL("../catalog.json", import.meta.url), JSON.stringify(catalog, null, 2));
  console.log(`\ncatalog.json → ${fields.length} fields, ` +
    `${fields.reduce((n, f) => n + f.backlog.length, 0)} backlog items, ` +
    `${fields.reduce((n, f) => n + f.docs.length, 0)} docs`);
};

main().catch((e) => { console.error(e); process.exit(1); });
