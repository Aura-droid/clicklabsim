# Click Lab Simulator

An interactive click-chemistry + machine-learning teaching platform, built as a fully client-side web app.

> **Developed by IIT Madras students:** Fredrick, Fatma, Vishal, Abiud, Anwar, Nabeel & Suleiman

## Screens

### 01 · Reaction Discovery Lab
Tune the parameters of a **CuAAC** or **SPAAC** reaction — temperature (20–100 °C), solvent, Cu(I) catalyst loading, concentration, time — and choose/edit substrate SMILES.

- **2D structures** rendered in-browser with **RDKit.js** (NCI CACTUS image API as fallback)
- **3D conformers** rendered with **3Dmol.js** (drag to rotate, scroll to zoom); coordinates fetched from the NIH CACTUS SDF endpoint
- **"Run AI Prediction Model"** fits/uses a ridge-regression yield predictor entirely in the browser (trained on a USPTO/ORD-style reaction-parameter dataset)
- An **assistant note** explains *why* that yield occurred. It is generated locally by default; point `WORKER_URL` in `js/lab.js` at your Cloudflare Worker to have **Gemini** write it instead.

### 02 · Bio-Orthogonal Cellular Sandbox
A canvas-rendered living cell: drifting native proteins (gray), a target protein tagged with an azide (N₃) handle, and a "Inject Probe" button that releases glowing DBCO–fluorophore probes. The probes diffuse through the membrane, ignore every native protein, and click selectively onto the target via SPAAC — lighting the cell up. This is the 2022 Nobel Prize chemistry, animated.

### 03 · Data Explorer & Model Evaluator
The predictor is not a black box:

- predicted-vs-observed scatter plot (held-out test set, Chart.js)
- residual distribution
- feature-importance chart (|standardised ridge coefficients|)
- model card with R², MAE, RMSE, train/test split notes and honest limitations

## Run locally

Any static file server works (no build step):

```bash
# XAMPP: drop the folder in htdocs and open
#   http://localhost/clicklabsim/

# or Python
python -m http.server 8080
#   http://localhost:8080/
```

Internet access is required for the CDN libraries (Chart.js, 3Dmol.js, RDKit.js) and the CACTUS conformer service.

## Deploy the Gemini proxy (optional)

The Gemini API key never ships to the browser — it lives in a Cloudflare Worker secret.

```bash
cd worker
npx wrangler deploy worker.js --name clicklab-gemini
npx wrangler secret put GEMINI_API_KEY
```

Then set `WORKER_URL` at the top of `js/lab.js` to your worker URL, e.g.

```js
const WORKER_URL = 'https://clicklab-gemini.<your-subdomain>.workers.dev';
```

The worker (`worker/worker.js`) validates the request, injects the key server-side, calls `gemini-2.0-flash`, and returns plain text with permissive CORS. If the worker is unset or unreachable, the app falls back to a local rule-based explanation so the demo never breaks.

## Tech stack

| Layer | Technology |
|---|---|
| UI | Vanilla HTML/CSS/JS, Orbitron + Rajdhani |
| 2D molecules | RDKit.js (WASM) → NCI CACTUS fallback |
| 3D molecules | 3Dmol.js + CACTUS SDF conformers |
| Cell simulation | HTML5 Canvas 2D |
| ML | In-browser ridge regression (closed-form solve) |
| Charts | Chart.js 4 |
| AI notes | Google Gemini via Cloudflare Worker proxy |

## Team

**Click Lab Simulator** — Fredrick · Fatma · Vishal · Abiud · Anwar · Nabeel · Suleiman — Indian Institute of Technology Madras.
