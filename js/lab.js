window.ClickLab = window.ClickLab || {};

ClickLab.lab = (() => {

  const WORKER_URL = 'https://clicklab-gemini-proxy.zcp26b002.workers.dev/';

  const state = {
    rxnType: 'cuaac',
    activeMol: 'azide',
    presetId: 'bz-phenyl',
    rdkit: null,
    rdkitLoading: null,
    viewer3d: null,
    customSmiles: false
  };

  const $ = id => document.getElementById(id);

  function currentPreset() {
    return ClickLab.data.PRESETS.find(p => p.id === state.presetId) ||
      ClickLab.data.PRESETS.find(p => p.rxn === state.rxnType);
  }

  function currentSmiles(molKey) {
    if (molKey === 'azide') return $('in-azide').value.trim();
    if (molKey === 'alkyne') return $('in-alkyne').value.trim();
    return currentPreset().product;
  }

  function loadRdkit() {
    if (state.rdkit) return Promise.resolve(state.rdkit);
    if (state.rdkitLoading) return state.rdkitLoading;
    state.rdkitLoading = new Promise((resolve, reject) => {
      if (window.initRDKitModule) {
        window.initRDKitModule().then(rdkit => { state.rdkit = rdkit; resolve(rdkit); }).catch(reject);
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/@rdkit/rdkit@2026.9.1/dist/RDKit_minimal.js';
      s.onload = () => {
        window.initRDKitModule()
          .then(rdkit => { state.rdkit = rdkit; resolve(rdkit); })
          .catch(reject);
      };
      s.onerror = () => reject(new Error('RDKit.js failed to load'));
      document.head.appendChild(s);
    });
    return state.rdkitLoading;
  }

  async function render2D(smiles) {
    const el = $('viewer-2d');
    el.innerHTML = '<div class="viewer-msg">Rendering structure&hellip;</div>';
    if (!smiles) { el.innerHTML = '<div class="viewer-msg">No SMILES entered.</div>'; return; }

    try {
      const RDKit = await loadRdkit();
      const mol = RDKit.get_mol(smiles);
      if (!mol) throw new Error('invalid SMILES');
      const svg = mol.get_svg(300, 280);
      mol.delete();
      el.innerHTML = svg;
    } catch (err) {
      try {
        const url = `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smiles)}/image`;
        el.innerHTML = `<img alt="2D depiction" src="${url}" onerror="this.parentElement.innerHTML='<div class=\\'viewer-msg\\'>Could not render this SMILES. Check the structure.</div>'">`;
      } catch {
        el.innerHTML = '<div class="viewer-msg">RDKit.js unavailable (offline?) — 2D view needs the CDN.</div>';
      }
    }
  }

  async function render3D(smiles) {
    const el = $('viewer-3d');
    if (!smiles) { el.innerHTML = '<div class="viewer-msg">No SMILES entered.</div>'; return; }

    if (!window.$3Dmol) {
      el.innerHTML = '<div class="viewer-msg">3Dmol.js failed to load — 3D view unavailable.</div>';
      state.viewer3d = null;
      return;
    }

    const oldMsg = document.getElementById('msg3d');
    if (oldMsg) oldMsg.remove();

    if (!state.viewer3d) {
      el.innerHTML = '';
      state.viewer3d = window.$3Dmol.createViewer(el, {
        backgroundColor: '#060a14',
        antialias: true
      });
    }
    const viewer = state.viewer3d;
    viewer.removeAllModels();
    viewer.removeAllSurfaces();
    viewer.removeAllShapes();

    el.insertAdjacentHTML('beforeend', '<div class="viewer-msg" id="msg3d" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">Fetching 3D conformer&hellip;</div>');

    try {
      const url = `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smiles)}/sdf`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('conformer lookup failed');
      const sdf = await res.text();
      if (!sDFLooksValid(sdf)) throw new Error('bad SDF');
      viewer.addModel(sdf, 'sdf');
      viewer.setStyle({}, { stick: { radius: 0.18 }, sphere: { scale: 0.28 } });
      viewer.addSurface(window.$3Dmol.SurfaceType.VDW, { opacity: 0.18, color: '#22d3ee' }, {});
      viewer.zoomTo();
      viewer.render();
      const msg = document.getElementById('msg3d');
      if (msg) msg.remove();
    } catch (err) {
      const msg = document.getElementById('msg3d');
      if (msg) msg.textContent = '3D conformer unavailable for this structure (check SMILES or network).';
    }
  }

  function sDFLooksValid(sdf) {
    const lines = sdf.split('\n');
    return lines.length > 4 && /V2000|V3000/.test(sdf);
  }

  function refreshMoleculeView() {
    const smiles = currentSmiles(state.activeMol);
    render2D(smiles);
    render3D(smiles);
  }

  function bindControls() {
    document.querySelectorAll('.rxn-card').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.rxn-card').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.rxnType = btn.dataset.rxn;
        const rxn = ClickLab.data.REACTIONS[state.rxnType];
        const preset = ClickLab.data.PRESETS.find(p => p.rxn === state.rxnType);
        state.presetId = preset.id;
        state.customSmiles = false;
        $('in-azide').value = preset.azide;
        $('in-alkyne').value = preset.alkyne;
        if (state.rxnType === 'spaac') {
          $('in-cat').value = 0;
          $('in-cat').disabled = true;
          $('out-cat').textContent = 'n/a';
          $('cat-hint').textContent = 'SPAAC is copper-free — ring strain drives the reaction, no catalyst needed.';
        } else {
          $('in-cat').disabled = false;
          $('out-cat').textContent = Number($('in-cat').value).toFixed(1) + ' mol%';
          $('cat-hint').textContent = 'CuAAC needs a Cu(I) catalyst (e.g. CuI with ligand).';
        }
        renderPresetChips();
        refreshMoleculeView();
      });
    });

    $('in-temp').addEventListener('input', e => { $('out-temp').textContent = `${e.target.value} °C`; });
    $('in-cat').addEventListener('input', e => { $('out-cat').textContent = `${Number(e.target.value).toFixed(1)} mol%`; });
    $('in-conc').addEventListener('input', e => { $('out-conc').textContent = `${Number(e.target.value).toFixed(2)} M`; });
    $('in-time').addEventListener('input', e => { $('out-time').textContent = `${e.target.value} h`; });

    const solventSel = $('in-solvent');
    ClickLab.data.SOLVENTS.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.label}  (ε ≈ ${s.polarity})`;
      solventSel.appendChild(opt);
    });
    solventSel.value = 'tbuh';
    solventSel.addEventListener('change', () => {
      const s = ClickLab.data.SOLVENTS.find(x => x.id === solventSel.value);
      $('solvent-hint').textContent = s.hint;
    });
    $('solvent-hint').textContent = ClickLab.data.SOLVENTS.find(x => x.id === 'tbuh').hint;

    ['in-azide', 'in-alkyne'].forEach(id => {
      $(id).addEventListener('change', () => {
        state.customSmiles = true;
        refreshMoleculeView();
      });
    });

    document.querySelectorAll('.mol-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.mol-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.activeMol = tab.dataset.mol;
        refreshMoleculeView();
      });
    });

    $('btn-run').addEventListener('click', runPrediction);
  }

  function renderPresetChips() {
    const row = $('preset-row');
    row.innerHTML = '';
    ClickLab.data.PRESETS.filter(p => p.rxn === state.rxnType).forEach(p => {
      const chip = document.createElement('button');
      chip.className = 'preset-chip' + (p.id === state.presetId && !state.customSmiles ? ' active' : '');
      chip.textContent = p.label;
      chip.addEventListener('click', () => {
        state.presetId = p.id;
        state.customSmiles = false;
        $('in-azide').value = p.azide;
        $('in-alkyne').value = p.alkyne;
        renderPresetChips();
        refreshMoleculeView();
      });
      row.appendChild(chip);
    });
  }

  function gatherParams() {
    const solvent = ClickLab.data.SOLVENTS.find(s => s.id === $('in-solvent').value);
    const cat = state.rxnType === 'spaac' ? 0 : Number($('in-cat').value);
    const temp = Number($('in-temp').value);
    return {
      type: state.rxnType,
      temp,
      cat,
      pol: solvent.polarity,
      solvent: solvent.label,
      conc: Number($('in-conc').value),
      time: Number($('in-time').value),
      azide: $('in-azide').value.trim(),
      alkyne: $('in-alkyne').value.trim()
    };
  }

  async function runPrediction() {
    const btn = $('btn-run');
    const status = $('run-status');
    btn.disabled = true;
    status.className = 'run-status';
    status.textContent = 'Running regression model in-browser…';

    const params = gatherParams();
    if (!params.azide || !params.alkyne) {
      status.className = 'run-status err';
      status.textContent = 'Please provide both an azide and an alkyne SMILES.';
      btn.disabled = false;
      return;
    }

    await new Promise(r => setTimeout(r, 350));

    let y;
    try {
      y = ClickLab.model.predict({
        temp: params.temp,
        cat: params.cat,
        pol: params.pol,
        conc: params.conc,
        time: params.time,
        type: params.type === 'cuaac' ? 1 : 0
      });
    } catch (e) {
      status.className = 'run-status err';
      status.textContent = 'Model not ready — try again in a second.';
      btn.disabled = false;
      return;
    }
    params.yield = y;

    const fitted = ClickLab.model.getFitted();
    $('yield-value').textContent = y.toFixed(1) + '%';
    $('yield-bar-fill').style.width = y + '%';
    $('yield-confidence').textContent =
      `test R² ${fitted.testMetrics.r2.toFixed(3)} · MAE ±${fitted.testMetrics.mae.toFixed(2)} pts · ridge regression, ${fitted.testMetrics.n} held-out reactions`;

    status.className = 'run-status ok';
    status.textContent = 'Prediction complete.';

    const note = ClickLab.model.localExplanation(params);
    setAssistantNote(note, 'local model');

    fetchGeminiNote(params);

    btn.disabled = false;
  }

  function setAssistantNote(text, source) {
    $('assistant-text').textContent = text;
    $('assistant-src').textContent = source;
  }

  async function fetchGeminiNote(params) {
    if (!WORKER_URL) return;
    const prompt = ClickLab.model.buildGeminiPrompt(params);
    setAssistantNote('Contacting Gemini through the Cloudflare Worker proxy…', 'Gemini');
    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!res.ok) throw new Error(`worker ${res.status}`);
      const data = await res.json();
      if (data.text) setAssistantNote(data.text, 'Gemini · Worker');
    } catch (e) {
      setAssistantNote(ClickLab.model.localExplanation(params), 'local model (Gemini unreachable)');
    }
  }

  function init() {
    bindControls();
    const preset = currentPreset();
    $('in-azide').value = preset.azide;
    $('in-alkyne').value = preset.alkyne;
    renderPresetChips();
    refreshMoleculeView();
  }

  return { init, WORKER_URL };
})();
