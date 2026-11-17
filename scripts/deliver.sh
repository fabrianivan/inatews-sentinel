#!/usr/bin/env bash
# ============================================================================
# INATEWS SENTINEL — Delivery script
#
# Prepares the project for hand-off / hackathon submission:
#   check    Preflight: tools, git state, secret leak scan
#   test     Backend Go tests + dashboard unit tests + production build
#   package  Build a clean source bundle + SUBMISSION.md into ./dist
#   docker   Build backend & dashboard Docker images
#   push     Push current branch to origin (asks for confirmation)
#   deploy   Deploy dashboard to Vercel production (asks for confirmation)
#   all      check -> test -> package
#
# Usage:
#   ./scripts/deliver.sh [command] [--wip] [--yes] [--demo-url URL] [--video-url URL]
#
#   --wip         Include uncommitted + untracked (non-ignored) files in the bundle.
#                 Default bundles only the committed HEAD.
#   --yes         Don't prompt for confirmation (push/deploy).
#   --demo-url    Live demo URL written into SUBMISSION.md
#   --video-url   Demo video URL written into SUBMISSION.md
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROJECT="inatews-sentinel"
DIST="${DIST_DIR:-$ROOT/dist}"
CMD="${1:-all}"; [[ $# -gt 0 ]] && shift || true
WIP=false; YES=false
DEMO_URL="${DEMO_URL:-}"; VIDEO_URL="${VIDEO_URL:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wip) WIP=true ;;
    --yes|-y) YES=true ;;
    --demo-url) DEMO_URL="$2"; shift ;;
    --video-url) VIDEO_URL="$2"; shift ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

# ---------- helpers ----------
c_red=$'\e[31m'; c_grn=$'\e[32m'; c_ylw=$'\e[33m'; c_cyn=$'\e[36m'; c_off=$'\e[0m'
step() { echo; echo "${c_cyn}━━ $* ━━${c_off}"; }
ok()   { echo "  ${c_grn}✔${c_off} $*"; }
warn() { echo "  ${c_ylw}⚠${c_off} $*"; WARNINGS=$((WARNINGS+1)); }
fail() { echo "  ${c_red}✘${c_off} $*"; FAILURES=$((FAILURES+1)); }
has()  { command -v "$1" >/dev/null 2>&1; }
confirm() {
  $YES && return 0
  read -r -p "  $1 [y/N] " ans; [[ "$ans" =~ ^[Yy]$ ]]
}
WARNINGS=0; FAILURES=0

VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo 0.0.0)"
SHA="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo -)"
STAMP="$(date +%Y%m%d-%H%M)"
REMOTE_URL="$(git remote get-url origin 2>/dev/null | sed -E 's#git@github.com:#https://github.com/#; s#\.git$##' || true)"

# ---------- check ----------
do_check() {
  step "Preflight checks"
  for t in git node npm; do has "$t" && ok "$t found" || fail "$t not installed"; done
  has go && ok "go $(go version | awk '{print $3}')" || warn "go not installed — backend tests/build will be skipped"
  has vercel || warn "vercel CLI not installed — 'deploy' needs: npm i -g vercel"

  # Git state
  local dirty; dirty="$(git status --porcelain | wc -l | tr -d ' ')"
  if [[ "$dirty" -gt 0 ]]; then
    warn "$dirty uncommitted/untracked change(s) on '$BRANCH' — commit them, or use --wip to bundle anyway"
  else ok "working tree clean"; fi

  git fetch --quiet origin 2>/dev/null || warn "could not fetch origin"
  if git rev-parse --verify -q "origin/$BRANCH" >/dev/null; then
    read -r behind ahead < <(git rev-list --left-right --count "origin/$BRANCH...HEAD")
    [[ "$ahead"  -gt 0 ]] && warn "$ahead local commit(s) not pushed to origin/$BRANCH"
    [[ "$behind" -gt 0 ]] && warn "$behind commit(s) on origin/$BRANCH not in local — run: git pull --rebase"
    [[ "$ahead" -eq 0 && "$behind" -eq 0 ]] && ok "in sync with origin/$BRANCH"
  else warn "no upstream origin/$BRANCH"; fi

  # Secrets must never be tracked
  for f in .env dashboard/.env.local backend/.env; do
    if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then fail "$f is tracked by git — remove it: git rm --cached $f"
    else ok "$f not tracked"; fi
  done

  # Secret pattern scan across tracked (and with --wip, untracked) files
  local pattern='(AIza[0-9A-Za-z_-]{35}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9]{32,}|ghp_[A-Za-z0-9]{36})'
  local hits
  hits="$(list_files | grep -vE '(^|/)(node_modules|\.next|dist)/|package-lock\.json$|\.example$' \
          | xargs -r grep -nIE "$pattern" 2>/dev/null || true)"
  if [[ -n "$hits" ]]; then
    fail "possible secrets found:"; echo "$hits" | sed 's/^/      /' | cut -c1-160
  else ok "no secret patterns in deliverable files"; fi

  [[ -d dashboard/public ]] || warn "dashboard/public missing — dashboard/Dockerfile 'COPY .../public' will fail (run: mkdir dashboard/public && touch dashboard/public/.gitkeep)"
  [[ -f README.md ]] && ok "README.md present" || fail "README.md missing"
}

# Files that go into the bundle
list_files() {
  { if $WIP; then git ls-files -co --exclude-standard; else git ls-files; fi; } \
    | grep -vE '\.DS_Store$|^\.claude/|^\.kilo/|(^|/)\.vercel/|^dist/' \
    | awk '!/(^|\/)\.env(\.[A-Za-z]+)?$/ || /\.env\.example$/' || true
}

# ---------- test ----------
do_test() {
  step "Backend (Go)"
  if has go; then
    (cd backend && go vet ./... && go test ./... && CGO_ENABLED=0 go build -o /tmp/inatews-server ./cmd/server) \
      && ok "go vet / test / build passed" || fail "backend checks failed"
  else warn "skipped (go not installed)"; fi

  step "Dashboard (Next.js)"
  (cd dashboard && npm ci --no-audit --no-fund >/dev/null) && ok "npm ci" || { fail "npm ci failed"; return; }
  (cd dashboard && npm test) && ok "unit tests passed" || fail "unit tests failed"
  (cd dashboard && npm run build) && ok "production build passed" || fail "next build failed"
}

# ---------- package ----------
do_package() {
  step "Packaging"
  mkdir -p "$DIST"
  local tag="${PROJECT}-v${VERSION}-${SHA}"; $WIP && tag="${tag}-wip"
  local out="$DIST/${tag}.zip"
  rm -f "$out"

  if $WIP; then
    list_files | zip -q "$out" -@
  else
    git archive --format=zip --prefix="${PROJECT}/" -o "$out" HEAD \
      ':(exclude).claude' ':(exclude).kilo' ':(exclude).DS_Store' ':(exclude)**/.DS_Store'
  fi
  ok "source bundle: dist/$(basename "$out") ($(du -h "$out" | cut -f1))"

  # Safety: verify no env files slipped into the archive
  if python3 -c 'import sys,zipfile,re; sys.exit(0 if any(re.search(r"(^|/)\.env(\.[A-Za-z]+)?$",n) and not n.endswith(".env.example") for n in zipfile.ZipFile(sys.argv[1]).namelist()) else 1)' "$out"; then
    fail "an .env file is inside the bundle — aborting"; rm -f "$out"; return
  fi
  ok "bundle contains no .env secrets"

  write_submission "$DIST/SUBMISSION.md"
  ok "submission notes: dist/SUBMISSION.md"
  (cd "$DIST" && shasum -a 256 "$(basename "$out")" > "$(basename "$out").sha256" 2>/dev/null \
     || sha256sum "$(basename "$out")" > "$(basename "$out").sha256")
  ok "checksum: dist/$(basename "$out").sha256"
}

write_submission() {
  cat > "$1" <<MD
# INATEWS Sentinel — Project Submission

**Tagline:** Real-time earthquake, tsunami & volcano early-warning intelligence for Indonesia.

| Item | Link |
|---|---|
| Source code | ${REMOTE_URL:-<add GitHub URL>} |
| Live demo | ${DEMO_URL:-<add demo URL>} |
| Demo video | ${VIDEO_URL:-<add video URL>} |
| Version / commit | v${VERSION} @ \`${SHA}\` (${BRANCH}) |
| Packaged | $(date '+%Y-%m-%d %H:%M %Z') |

## Problem
Indonesia sits on several of the world's most active subduction zones. Seismic, ocean-buoy,
geodetic and weather signals arrive from separate systems, so responders (BMKG, BNPB, BASARNAS)
lose critical minutes correlating them by hand.

## Solution
INATEWS Sentinel streams BMKG/USGS seismic data, InaTEWS tsunami buoys & tide gauges, InSAR
displacement, infrastructure and weather feeds through **Confluent Cloud (Kafka)**. **Apache Flink SQL**
correlates them in real time to compute a National Seismic Intensity Index (MMI), multi-stream hazard
alerts and tsunami wave anomalies. An **AI decision-support agent** (Google Gemini / AWS Bedrock, with a
heuristic fallback) explains risk and drafts directives per agency, shown on a live tactical dashboard.

> Decision-support and rapid impact estimation — not an earthquake prediction system.

## Tech stack
Go 1.23 (Gin, confluent-kafka-go) · Confluent Cloud Kafka + Flink SQL · Google Gemini 2.5 Flash /
AWS Bedrock · Next.js + React + Leaflet · Vercel / GCP VM / Docker

## Run it
\`\`\`bash
cp .env.example .env          # or set DEMO_MODE=true to run without cloud credentials
npm run dev                   # starts Go backend :8080 + dashboard :3000
\`\`\`

## Recognition
3rd Prize — The Most Creative AI App, Confluent AI Day Indonesia 2026.
MD
}

# ---------- docker ----------
do_docker() {
  step "Docker images"
  has docker || { fail "docker not installed"; return; }
  docker build -t "${PROJECT}-backend:${SHA}" backend && ok "${PROJECT}-backend:${SHA}"
  mkdir -p dashboard/public
  docker build -t "${PROJECT}-dashboard:${SHA}" dashboard && ok "${PROJECT}-dashboard:${SHA}"
}

# ---------- push ----------
do_push() {
  step "Push to origin"
  if [[ -n "$(git status --porcelain)" ]]; then fail "uncommitted changes — commit first"; return; fi
  if git rev-parse --verify -q "origin/$BRANCH" >/dev/null; then
    read -r behind _ < <(git rev-list --left-right --count "origin/$BRANCH...HEAD")
    [[ "$behind" -gt 0 ]] && { fail "branch is behind origin — run: git pull --rebase origin $BRANCH"; return; }
  fi
  confirm "Push '$BRANCH' to origin?" && git push -u origin "$BRANCH" && ok "pushed" || warn "push skipped"
}

# ---------- deploy ----------
do_deploy() {
  step "Deploy dashboard to Vercel (production)"
  has vercel || { fail "vercel CLI missing (npm i -g vercel)"; return; }
  confirm "Deploy dashboard to Vercel production?" || { warn "deploy skipped"; return; }
  local url; url="$(cd dashboard && vercel deploy --prod --yes | tail -1)"
  ok "deployed: $url"
  DEMO_URL="$url"
  [[ -f "$DIST/SUBMISSION.md" ]] && write_submission "$DIST/SUBMISSION.md" && ok "SUBMISSION.md updated with demo URL"
}

summary() {
  step "Summary"
  echo "  failures: $FAILURES   warnings: $WARNINGS"
  [[ "$FAILURES" -eq 0 ]] && echo "  ${c_grn}Ready to deliver.${c_off}" || { echo "  ${c_red}Fix failures before delivering.${c_off}"; exit 1; }
}

case "$CMD" in
  check)   do_check ;;
  test)    do_test ;;
  package) do_package ;;
  docker)  do_docker ;;
  push)    do_push ;;
  deploy)  do_deploy ;;
  all)     do_check; do_test; do_package ;;
  -h|--help|help) sed -n '2,24p' "$0"; exit 0 ;;
  *) echo "Unknown command: $CMD (try --help)"; exit 1 ;;
esac
summary
