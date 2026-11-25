#!/usr/bin/env bash
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly RELEASE_BRANCH="main"
readonly CONFIRMATION_WORD="deploy"
readonly FORBIDDEN_PATH='(^|/)(\.env(\..*)?|\.npmrc|\.netrc|\.railway|\.git|node_modules|id_(rsa|dsa|ecdsa|ed25519)[^/]*|[^/]*\.(pem|key|p12|pfx|keystore|jks))(/|$)'
readonly ALLOWED_DOTFILES='^(\.gitignore|\.prettierignore|\.prettierrc)$'

mode="deploy"
case "${1:-}" in
  --check) mode="check" ;;
  "") ;;
  *)
    echo "Usage: npm run deploy:railway [-- --check]" >&2
    exit 2
    ;;
esac

step() { printf '\n==> %s\n' "$1"; }
fail() {
  printf '\nDeployment stopped: %s\n' "$1" >&2
  exit 1
}

audit_upload_directory() {
  local directory="$1"
  local commit="$2"
  if [[ -n "$(find "$directory" -type l -print -quit)" ]]; then
    fail "the export contains a symbolic link."
  fi
  local files
  files="$(cd "$directory" && find . -type f | sed 's|^\./||' | LC_ALL=C sort)"
  if grep -Eq "$FORBIDDEN_PATH" <<<"$files"; then
    fail "the export contains a file that must never be uploaded: $(grep -E "$FORBIDDEN_PATH" <<<"$files" | head -1)"
  fi
  local dotfile
  while IFS= read -r dotfile; do
    [[ -z "$dotfile" ]] && continue
    if ! grep -Eq "$ALLOWED_DOTFILES" <<<"$(basename "$dotfile")"; then
      fail "the export contains an unexpected hidden file: ${dotfile#./}"
    fi
  done < <(cd "$directory" && find . -name '.*' ! -name '.' -print)
  if [[ "$files" != "$(git ls-tree -r --name-only "$commit" | LC_ALL=C sort)" ]]; then
    fail "the files to upload differ from the files in commit ${commit:0:12}."
  fi
}

free_port() {
  node -e "const server = require('node:net').createServer().listen(0, '127.0.0.1', () => { console.log(server.address().port); server.close(); });"
}

smoke_test() {
  local site="$1"
  local expected_sha="$2"
  local port
  port="$(free_port)"
  (cd "$site" && exec env PORT="$port" node scripts/deployment/serve.js) >"$staging/server.log" 2>&1 &
  local server_pid=$!
  local result=0
  XCR_SMOKE_PORT="$port" XCR_EXPECTED_SHA="$expected_sha" node --input-type=module -e '
    const base = `http://127.0.0.1:${process.env.XCR_SMOKE_PORT}`;
    const deadline = Date.now() + 15000;
    let ready = false;
    while (!ready && Date.now() < deadline) {
      ready = await fetch(base).then(() => true, () => false);
      if (!ready) await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!ready) throw new Error("the production server did not start");
    const expectations = [
      ["/", 200, "text/html"],
      ["/symbols/xrpl/ApplyContext", 200, "text/html"],
      ["/symbols/xrpl/detail/ApplyViewBase/open/3d5a0786", 200, "text/html"],
      ["/data/current.json", 200, "application/json"],
      ["/assets/missing.js", 404, "text/plain"],
      ["/.env", 404, "text/plain"],
      ["/package.json", 404, "text/plain"],
    ];
    for (const [path, status, type] of expectations) {
      const response = await fetch(base + path);
      if (response.status !== status || !response.headers.get("content-type").startsWith(type)) {
        throw new Error(`${path} returned ${response.status} ${response.headers.get("content-type")}`);
      }
    }
    const pointer = await (await fetch(base + "/data/current.json")).json();
    if (pointer.commitSha !== process.env.XCR_EXPECTED_SHA) {
      throw new Error(`the server published rippled ${pointer.commitSha}`);
    }
  ' || result=$?
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  [[ "$result" -eq 0 ]] || fail "the production server smoke test failed."
}

cd "$PROJECT_ROOT"

for command in git node npm tar find; do
  command -v "$command" >/dev/null 2>&1 || fail "$command is required."
done
if [[ "$mode" == "deploy" ]]; then
  command -v railway >/dev/null 2>&1 || fail "the Railway CLI is not installed. See docs/deployment/RAILWAY_DEPLOYMENT.md."
  [[ -t 0 ]] || fail "deployments must be confirmed interactively in a terminal."
fi

step "Checking that the working tree is clean"
[[ -z "$(git status --porcelain --untracked-files=all)" ]] ||
  fail "commit or remove every change first. Only committed, reviewed files are deployed."
commit="$(git rev-parse HEAD)"

step "Checking that ${commit:0:12} is the reviewed commit on origin/${RELEASE_BRANCH}"
git fetch --quiet origin "$RELEASE_BRANCH" || fail "could not fetch origin/${RELEASE_BRANCH}."
[[ "$commit" == "$(git rev-parse "origin/${RELEASE_BRANCH}")" ]] ||
  fail "HEAD must be the commit at origin/${RELEASE_BRANCH}. Check out ${RELEASE_BRANCH} and push the reviewed commit first."

staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT
site="$staging/site"
mkdir "$site"

step "Exporting commit ${commit:0:12}"
git archive --format=tar "$commit" | tar -x -C "$site" || fail "could not export commit ${commit:0:12}."
audit_upload_directory "$site" "$commit"

step "Installing the locked dependencies"
(cd "$site" && npm ci --no-audit --no-fund --loglevel=error) || fail "npm ci failed. Check package-lock.json."

step "Validating the committed documentation dataset"
(cd "$site" && npm run --silent docs:validate) || fail "the committed documentation dataset failed validation."
dataset_sha="$(cd "$site" && node -p "JSON.parse(require('node:fs').readFileSync('public/data/current.json', 'utf8')).commitSha")"

step "Building the production site"
(cd "$site" && npm run --silent build >"$staging/build.log" 2>&1) || {
  cat "$staging/build.log" >&2
  fail "the production build failed."
}

step "Smoke-testing the production server"
smoke_test "$site" "$dataset_sha"

step "Removing local build output from the upload"
rm -rf "$site/node_modules" "$site/dist"
audit_upload_directory "$site" "$commit"

printf '\nCommit:            %s  %s\n' "${commit:0:12}" "$(git log -1 --format=%s "$commit")"
printf 'Documented rippled: XRPLF/rippled@%s\n' "$dataset_sha"
printf 'Files to upload:    %s (%s)\n' "$(find "$site" -type f | wc -l | tr -d ' ')" "$(du -sh "$site" | cut -f1)"

if [[ "$mode" == "check" ]]; then
  printf '\nAll deployment checks passed. Nothing was uploaded.\n'
  exit 0
fi

step "Railway target"
railway status || fail "this folder is not linked to a Railway service. Run: railway link"

printf '\n'
read -r -p "Type '${CONFIRMATION_WORD}' to upload commit ${commit:0:12} to this Railway service: " answer
[[ "$answer" == "$CONFIRMATION_WORD" ]] || fail "not confirmed. Nothing was uploaded."

step "Uploading to Railway"
railway up "$site" --path-as-root --ci --message "XRPL Core Reference ${commit:0:12} (rippled ${dataset_sha:0:12})"
printf '\nUpload finished. Verify the site using docs/deployment/RAILWAY_DEPLOYMENT.md.\n'
