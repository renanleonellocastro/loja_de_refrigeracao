#!/usr/bin/env bash
# Contract fuzzing with Schemathesis against a running API with the development seed (docs/TESTES.md).
# Usage: infra/schemathesis.sh [base url]. Needs uvx (or set SCHEMATHESIS to another launcher).
#
# Excluded on purpose (documented false positives, docs/TESTES.md):
#   positive_data_acceptance  business rules reject schema valid data (expired links, empty cart,
#                             wrong current password, If-Match required); they answer documented 4xx.
#   unsupported_method        Fastify answers 404 instead of 405 for methods a path does not route.
#   /api/v1/addresses/lookup  calls ViaCEP, an external service the CI must not hammer.
#   /api/v1/auth/* and /api/v1/me* in the signed in run: they would end the fuzzing session itself
#                             (logout, password change, account deletion); the anonymous run covers them.
set -euo pipefail

BASE="${1:-http://localhost:3001}"
SPEC="$BASE/api/v1/openapi.json"
EMAIL="${FUZZ_EMAIL:-gerente@castro.dev}"
PASSWORD="${FUZZ_PASSWORD:-Castro-Dev-2026}"
read -r -a ST <<< "${SCHEMATHESIS:-uvx schemathesis==4.29.3}"
COMMON=(
  --url "$BASE"
  --checks all
  --exclude-checks positive_data_acceptance,unsupported_method
  --exclude-path /api/v1/addresses/lookup
  --max-examples "${FUZZ_EXAMPLES:-25}"
  --workers 4
)

# Signs in first: the anonymous run fuzzes the login and trips its per IP limit.
SESSION=$(curl -fsS -X POST "$BASE/api/v1/auth/sessions" -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(python3 -c 'import json, sys; print(json.loads(sys.argv[1])["accessToken"])' "$SESSION")

status=0
echo "Anonymous run"
"${ST[@]}" run "$SPEC" "${COMMON[@]}" || status=1

echo "Signed in run as $EMAIL"
"${ST[@]}" run "$SPEC" "${COMMON[@]}" \
  --exclude-path-regex '^/api/v1/(auth/|me$|me/)' \
  -H "Authorization: Bearer $TOKEN" || status=1
exit "$status"
