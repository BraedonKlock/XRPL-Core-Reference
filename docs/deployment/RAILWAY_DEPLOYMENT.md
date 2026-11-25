# Deploying to Railway

XRPLD C++ Reference is a static site. On Railway it runs as one service: Railpack builds it with Vite, and a small, dependency-free Node server (`scripts/deployment/serve.js`) serves `dist/`. There is no backend, database, scheduled job or secret.

Deployments are entirely manual. Railway is **not** connected to GitHub, so pushing code never changes the website. The website changes only when you run `npm run deploy:railway` and type `deploy` to confirm.

## How a deployment works

```
your reviewed commit on origin/main
  │  npm run deploy:railway
  │    1. requires a clean working tree, and HEAD equal to origin/main
  │    2. exports exactly that commit (git archive) into a temporary folder
  │    3. refuses symbolic links, .env files, keys, .railway, .git, node_modules
  │    4. npm ci → npm run docs:validate → npm run build → production-server smoke test
  │    5. deletes node_modules and dist, and checks the upload equals the commit's file list
  │    6. shows the Railway target and asks you to type "deploy"
  │    7. railway up <temporary folder> --path-as-root --ci
  ▼
Railway (Railpack)
  │  installs dependencies, runs npm run build, starts node scripts/deployment/serve.js
  ▼
https://<generated name>.railway.app (HTTPS)
```

Three separate actions:

1. **Pushing to GitHub** only stores code. Railway never sees it.
2. **Building a deployment** happens on Railway when `npm run deploy:railway` uploads a commit.
3. **Publishing** happens when that build succeeds and the new server starts. If the build or start fails, the previous deployment stays live.

The documentation dataset in `public/data/` is committed to git and deployed as-is. Nothing during deployment clones rippled, runs Doxygen or regenerates documentation.

## Initial setup

You need your own Railway account. Never paste a Railway token or password into a file, chat, or terminal history. Railway's dashboard labels change from time to time; if a label below differs slightly, look for the closest match.

1. **Install the Railway CLI** on your machine, using one of the methods in [Railway's CLI guide](https://docs.railway.com/guides/cli), for example `npm install -g @railway/cli`. Check it with `railway --version`.
2. **Sign in:** run `railway login`. It opens your browser; use `railway login --browserless` on a machine without one. The CLI stores its session in your home directory, not in this repository.
3. **Create an empty project** in the [Railway dashboard](https://railway.com/dashboard): **New Project → Empty Project**. Do **not** choose "Deploy from GitHub repo".
4. **Add an empty service** in the project: **Create → Empty Service**, and give it a name such as `xrpl-core-reference`.
5. **Set one service variable** under the service's **Variables** tab:

   | Name                        | Value    | Why                                                                                             |
   | --------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
   | `RAILPACK_NODE_NPM_INSTALL` | `npm ci` | Railpack installs with `npm install` by default; `npm ci` installs exactly `package-lock.json`. |

   Do not set `PORT`. Railway provides it automatically.

6. **Check the service settings:**
   - **Source:** no repository is connected. Leave it that way.
   - **Build:** builder is Railpack. Leave the custom build and start commands empty. `railpack.json` selects Node 22 and the start command `node scripts/deployment/serve.js`, and Railpack runs `npm run build` automatically.
   - **Healthcheck path** (in the deploy settings): `/`. Railway then switches traffic only after the new server responds.
   - **Deploy → Cron Schedule:** empty.
7. **Link this folder to the service:** in the repository root, run `railway link` and choose the workspace, project, `production` environment and service. The link is stored outside git (`.railway/` is gitignored).
8. **Run the first deployment** (see [Manual deployment](#manual-deployment)).
9. **Generate the public domain:** service **Settings → Networking → Public Networking → Generate Domain**. Railway issues a `railway.app` address, and provisions and renews its HTTPS certificate automatically. If it asks for a port, use the one in the deploy log line `serving … on 0.0.0.0:<port>`.

## Disabling automatic deployments

Automatic deployments are impossible by construction:

- The Railway service has no connected repository, so GitHub pushes, merges and tags cannot trigger a build.
- The repository has no GitHub Actions workflows and contains no Railway token, so nothing in CI can deploy.
- No cron schedule is set on the service.
- `npm run deploy:railway` refuses to run without a terminal, and it requires you to type `deploy`.

To confirm at any time, open the service's **Settings → Source**: it must show no connected repository. If a repository is ever connected, Railway deploys on every push to the trigger branch until you click **Disable** under its automatic-deployment setting. Connecting one is not part of this project's process.

## Manual deployment

```bash
git switch main
git pull --ff-only
npm ci
npm run deploy:railway -- --check
npm run deploy:railway
```

- `--check` runs every step except the upload. Use it whenever you like; it never contacts Railway.
- The deploy run prints the commit, the documented rippled commit and the number of files, shows `railway status`, and asks you to type `deploy`. Anything else cancels without uploading.
- It streams Railway's build log and exits when the build finishes. The Railway dashboard shows the deployment with the message `XRPLD C++ Reference <commit> (rippled <commit>)`.

Only committed, pushed files can be deployed. Uncommitted edits, untracked files, `.env` files and anything gitignored never leave your machine.

### Running the production server locally

```bash
npm run build
npm run serve
```

Then open http://localhost:8080. `PORT=4173 npm run serve` picks another port. This is the same command Railway runs, and the Playwright tests (`npm run test:e2e`) run against it.

## Environment configuration

| Value                       | Kind                             | Where                               |
| --------------------------- | -------------------------------- | ----------------------------------- |
| `PORT`                      | Provided by Railway              | Set automatically                   |
| `RAILPACK_NODE_NPM_INSTALL` | Public build configuration       | Railway service variable            |
| Railway login session       | Private, belongs to your account | Railway CLI, outside the repository |

The site needs no secrets. Never commit:

- Railway tokens (`RAILWAY_TOKEN`, `RAILWAY_API_TOKEN`);
- the `.railway/` folder;
- `.env` files;
- keys or certificates.

`.gitignore` excludes all of these, and the deploy script refuses to upload them. Never put a secret in a `VITE_` variable or `import.meta.env`, because Vite copies those into the public JavaScript.

## Updating the documentation

Regenerating documentation and deploying the website are separate steps. Regenerating changes only local files; the website is unchanged until you deploy.

1. Regenerate for an explicit commit of rippled `develop`:

   ```bash
   npm run docs:generate -- --commit <full 40-character SHA>
   ```

2. Validate and test it:

   ```bash
   npm run docs:validate
   npm test
   XCR_E2E_BROWSERS=chromium,firefox npm run test:e2e
   ```

   Some tests name the pinned commit or specific overload URLs. They fail deliberately after a regeneration, so that you confirm the new values before updating the tests.

3. Review the change:

   ```bash
   git status --short public/data | head
   git diff --stat -- public/data | tail -1
   cat public/data/current.json
   ```

   The old dataset folder is replaced by one named after the new commit, and `current.json` points to it.

4. Commit, push, and then deploy as described in [Manual deployment](#manual-deployment).

## Rollback

**Fastest:** in the Railway dashboard, open the service's **Deployments**, find the last good deployment, open its **⋯** menu and choose **Rollback**. Railway redeploys that deployment's uploaded source. Deployments older than your plan's retention period cannot be rolled back.

**Through git:** revert the bad commit (`git revert <commit>`), push, and run `npm run deploy:railway`. Use this when the bad deployment is too old to roll back, or so that `main` matches the live site again.

After either kind of rollback, run the checks in [Verifying the live site](#verifying-the-live-site).

## Verifying the live site

Replace `<domain>` with your Railway domain.

1. **Home page:** `https://<domain>/` shows the overview and `XRPLF/rippled@develop c2534ff` in the header.
2. **Deep links:** open `https://<domain>/symbols/xrpl/detail/ApplyViewBase/open/3d5a0786` directly. It shows "Documentation inherited from xrpl::ReadView::open". Refresh: the page stays.
3. **Search:** type `ApplyContext` in the header search, press Enter on the first suggestion, and the class page opens.
4. **Source links:** on a method page, a source link opens `github.com/XRPLF/rippled/blob/c2534ff9c84422e00711da31629a76f3f59feb98/...` at the right line.
5. **HTTPS:** the address bar shows a valid certificate. `http://<domain>/` should redirect to HTTPS; Railway's edge normally does this. If it does not, `Strict-Transport-Security` still keeps browsers on HTTPS after their first secure visit.
6. **Console:** open the browser developer tools on several pages. There should be no errors and no failed requests.
7. **Headers:**

   ```bash
   curl -sI https://<domain>/ | grep -iE 'content-security|strict-transport|x-content-type|x-frame'
   ```

   All four headers are present.

8. **Missing files:** these must each print `404`:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/assets/missing.js
   curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/.env
   curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/package.json
   ```

## Production server behaviour

- **Files served:** only regular files under `dist/`, loaded into memory at startup. Hidden files, symbolic links and the GitHub Pages `404.html` are excluded. No filesystem path is ever built from a request.
- **Routes:** application routes such as `/symbols/...` and `/search` receive `index.html`, and React Router renders the page or its not-found message.
- **Missing files:** anything under `/assets/` or `/data/`, or with a file extension, that does not exist gets a plain-text `404`, never the HTML page.
- **Rejected requests:** malformed encodings, `..` segments, backslashes and NUL bytes get `400`. Methods other than GET and HEAD get `405`.
- **Security headers:**
  - a Content-Security-Policy that allows only same-origin resources and the inline theme script, by its hash;
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and `X-Frame-Options: DENY`;
  - the cross-origin isolation headers and a restrictive `Permissions-Policy`;
  - `Strict-Transport-Security` on HTTPS requests.
- **Caching:**
  - hashed `/assets/` files are cached for a year (`immutable`);
  - `index.html` and `data/current.json` are always revalidated;
  - dataset files are cached for an hour;
  - every response has an `ETag`, and text is gzip-compressed.
- **Logging:** one startup line (file count and rippled commit), a shutdown line, and the error message for any request that fails unexpectedly. Request headers are never logged, and error responses never include stack traces or paths.

## Troubleshooting

| Symptom                                                              | Cause and fix                                                                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The deploy script stops at "working tree is clean"                   | Commit or remove the listed changes (`git status`).                                                                                                    |
| The deploy script stops at "origin/main"                             | Push the reviewed commit, or `git switch main && git pull --ff-only`.                                                                                  |
| The deploy script stops at "failed validation"                       | The committed dataset changed or is incomplete. Run `npm run docs:validate` and restore `public/data` from git.                                        |
| The Railway build fails in `npm ci`                                  | `package-lock.json` does not match `package.json`. Run `npm install`, commit the lockfile, and deploy again.                                           |
| The Railway build log shows `npm install` instead of `npm ci`        | The `RAILPACK_NODE_NPM_INSTALL` service variable is missing.                                                                                           |
| The deploy log says "No production build found"                      | Railpack did not run `npm run build`. Check that the build log has a Vite build step, and that no custom build command is set in the service settings. |
| The deploy log says "has no documentation dataset"                   | `public/data` was not committed. Check with `git ls-files public/data \| head`.                                                                        |
| The service starts Vite or `start-local.sh`                          | A custom start command overrides `railpack.json`. Clear it in the service settings.                                                                    |
| The service crashes with "PORT must be an integer"                   | A `PORT` variable was set by hand. Delete it and let Railway provide it.                                                                               |
| The domain shows "Application failed to respond"                     | The domain targets the wrong port. Use the port from the deploy log line `serving … on 0.0.0.0:<port>`.                                                |
| Deep links return 404                                                | A different server is running. The deploy log must show `XRPLD C++ Reference: serving …`.                                                              |
| Assets or data request `/XRPL-Core-Reference/...`                    | The site was built with the GitHub Pages base path. Railway must run `npm run build`, not `npm run build:pages`.                                       |
| The page loads without styles, or the console reports CSP violations | `dist/index.html` and the running server are from different builds. Redeploy so that both come from the same build.                                    |
| The upload is rejected as too large                                  | Railway's upload limit was exceeded. The upload is about 40 MB before compression; check the size the deploy script prints.                            |
