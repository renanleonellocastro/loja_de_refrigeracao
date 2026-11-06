#!/usr/bin/env bash
# Nightly dependency audit (docs/SEGURANCA.md section 5). On pull requests and pushes `pnpm audit` blocks the
# merge; on the nightly run the code did not change, so a new advisory must reach a person without failing
# the run every night. This script keeps one open issue labelled "seguranca":
#   * advisories found and no open issue: open it (one notification);
#   * advisories found and the issue is open: refresh its body silently, and comment (one notification)
#     only when an advisory id appears that the issue did not list yet;
#   * audit clean and the issue is open: close it with a comment.
# Needs GH_TOKEN with issues: write. Usage: infra/audit-report.sh
set -euo pipefail

TITLE='Alertas de segurança em dependências (pnpm audit)'
LABEL='seguranca'
WORK="$(mktemp -d)"
trap 'rm -r "$WORK"' EXIT

advisory_ids() {
  grep -o 'GHSA-[0-9a-z]\{4\}-[0-9a-z]\{4\}-[0-9a-z]\{4\}' | sort -u || true
}

find_open_issue() {
  gh issue list --label "$LABEL" --state open --json number,title \
    --jq ".[] | select(.title == \"$TITLE\") | .number" | head -n 1
}

# The backticks below are Markdown code spans in the issue body, not command substitutions.
# shellcheck disable=SC2016
write_body() {
  {
    echo 'A auditoria noturna (`pnpm audit --prod --audit-level high`) encontrou alertas altos ou críticos.'
    echo 'O código não mudou: são alertas novos publicados para dependências que já usamos.'
    echo
    echo "Execução: $RUN_URL"
    echo
    echo 'Como resolver: atualizar a dependência direta para a versão corrigida, ou, se o alerta vier de uma'
    echo 'dependência transitiva, renovar o lockfile ou usar `overrides` em `pnpm-workspace.yaml` com comentário.'
    echo 'Esta issue fecha sozinha quando a auditoria noturna ficar limpa.'
    echo
    echo '```'
    head -c 60000 "$WORK/audit.txt"
    echo '```'
  } >"$WORK/body.md"
}

report_advisories() {
  local issue="$1"
  write_body
  if [ -z "$issue" ]; then
    gh issue create --title "$TITLE" --label "$LABEL" --body-file "$WORK/body.md"
    return
  fi
  gh issue view "$issue" --json body --jq .body | advisory_ids >"$WORK/known.txt"
  advisory_ids <"$WORK/audit.txt" >"$WORK/current.txt"
  comm -13 "$WORK/known.txt" "$WORK/current.txt" >"$WORK/new.txt"
  gh issue edit "$issue" --body-file "$WORK/body.md"
  if [ -s "$WORK/new.txt" ]; then
    { echo 'Novos alertas desde a última atualização:'; sed 's/^/* /' "$WORK/new.txt"; } >"$WORK/comment.md"
    gh issue comment "$issue" --body-file "$WORK/comment.md"
  fi
}

RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"
status=0
pnpm audit --prod --audit-level high >"$WORK/audit.txt" 2>&1 || status=$?
cat "$WORK/audit.txt"
issue="$(find_open_issue)"

if [ "$status" -ne 0 ]; then
  report_advisories "$issue"
elif [ -n "$issue" ]; then
  gh issue close "$issue" --comment "A auditoria noturna ficou limpa ($RUN_URL)."
fi
