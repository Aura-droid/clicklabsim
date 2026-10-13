window.ClickLab = window.ClickLab || {};

ClickLab.model = (() => {

  const FEATURE_DEFS = [
    { key: 'temp',         label: 'Temperature (°C)',        fn: f => f.temp },
    { key: 'temp2',        label: 'Temperature²',            fn: f => f.temp * f.temp / 1000 },
    { key: 'cat',          label: 'Catalyst loading (mol%)', fn: f => f.cat },
    { key: 'cat135',       label: 'Catalyst^1.35',           fn: f => Math.pow(f.cat, 1.35) },
    { key: 'pol',          label: 'Solvent polarity (ε)',    fn: f => f.pol },
    { key: 'pol2',         label: 'Polarity²',               fn: f => f.pol * f.pol / 1000 },
    { key: 'typeXpol',     label: 'Type × Polarity',         fn: f => f.type * f.pol / 10 },
    { key: 'typeXpol2',    label: 'Type × Polarity²',        fn: f => f.type * f.pol * f.pol / 1000 },
    { key: 'conc',         label: 'Concentration (M)',       fn: f => f.conc },
    { key: 'concHinge',    label: 'Conc. penalty hinge',     fn: f => Math.max(0, f.conc - 0.4) },
    { key: 'time',         label: 'Time (h)',                fn: f => f.time },
    { key: 'logTime',      label: 'log(Time)',               fn: f => Math.log(1 + f.time) },
    { key: 'type',         label: 'Reaction type (CuAAC=1)', fn: f => f.type },
    { key: 'typeXtemp',    label: 'Type × Temperature',      fn: f => f.type * f.temp / 100 },
    { key: 'typeXcat',     label: 'Type × Catalyst',         fn: f => f.type * f.cat },
    { key: 'kinetic',      label: 'Type × Temp × log(1+Cu)', fn: f => f.type * (f.temp - 25) * Math.log(1 + f.cat) / 100 }
  ];

  function designMatrix(rows) {
    return rows.map(r => [1, ...FEATURE_DEFS.map(d => d.fn(r.features))]);
  }

  function standardizeTrain(X) {
    const nFeat = X[0].length;
    const means = new Array(nFeat).fill(0);
    const stds = new Array(nFeat).fill(0);
    for (const row of X) for (let j = 0; j < nFeat; j++) means[j] += row[j];
    for (let j = 0; j < nFeat; j++) means[j] /= X.length;
    for (const row of X) for (let j = 0; j < nFeat; j++) stds[j] += (row[j] - means[j]) ** 2;
    for (let j = 0; j < nFeat; j++) stds[j] = Math.sqrt(stds[j] / X.length) || 1;
    means[0] = 0; stds[0] = 1;
    const Z = X.map(row => row.map((v, j) => (v - means[j]) / stds[j]));
    return { Z, means, stds };
  }

  function solve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      [M[col], M[piv]] = [M[piv], M[col]];
      if (Math.abs(M[col][col]) < 1e-12) M[col][col] = 1e-12;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const factor = M[r][col] / M[col][col];
        for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
      }
    }
    return M.map((row, i) => row[n] / M[i][i]);
  }

  function fitRidge(X, y, lambda = 0.8) {
    const n = X[0].length;
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    const b = new Array(n).fill(0);
    for (let i = 0; i < X.length; i++) {
      for (let j = 0; j < n; j++) {
        b[j] += X[i][j] * y[i];
        for (let k = 0; k < n; k++) A[j][k] += X[i][j] * X[i][k];
      }
    }
    for (let j = 1; j < n; j++) A[j][j] += lambda;
    return solve(A, b);
  }

  function metrics(yTrue, yPred) {
    const n = yTrue.length;
    const mean = yTrue.reduce((a, b) => a + b, 0) / n;
    let ssRes = 0, ssTot = 0, absSum = 0, sqSum = 0;
    for (let i = 0; i < n; i++) {
      const e = yTrue[i] - yPred[i];
      ssRes += e * e;
      ssTot += (yTrue[i] - mean) ** 2;
      absSum += Math.abs(e);
      sqSum += e * e;
    }
    return { r2: 1 - ssRes / ssTot, mae: absSum / n, rmse: Math.sqrt(sqSum / n), n };
  }

  let fitted = null;

  function train(rows) {
    const rnd = ClickLab.data.mulberry32(777);
    const idx = rows.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const cut = Math.floor(idx.length * 0.8);
    const trainRows = idx.slice(0, cut).map(i => rows[i]);
    const testRows = idx.slice(cut).map(i => rows[i]);

    const XtrFull = designMatrix(trainRows);
    const { Z, means, stds } = standardizeTrain(XtrFull);
    const ytr = trainRows.map(r => r.yield);
    const coef = fitRidge(Z, ytr, 0.8);

    const XteFull = designMatrix(testRows);
    const Zte = XteFull.map(row => row.map((v, j) => (v - means[j]) / stds[j]));
    const yte = testRows.map(r => r.yield);
    const predTe = Zte.map(row => row.reduce((s, v, j) => s + v * coef[j], 0));
    const testMetrics = metrics(yte, predTe);

    const trainPred = Z.map(row => row.reduce((s, v, j) => s + v * coef[j], 0));
    const trainMetrics = metrics(ytr, trainPred);

    const importance = FEATURE_DEFS.map((d, i) => ({
      key: d.key,
      label: d.label,
      weight: coef[i + 1],
      abs: Math.abs(coef[i + 1])
    })).sort((a, b) => b.abs - a.abs);

    fitted = { coef, means, stds, testMetrics, trainMetrics, importance, testRows, predTe };

    const yAll = rows.map(r => r.yield);
    const predAll = designMatrix(rows).map(row => {
      const z = row.map((v, j) => (v - means[j]) / stds[j]);
      return z.reduce((s, v, j) => s + v * coef[j], 0);
    });
    fitted.allMetrics = metrics(yAll, predAll);
    fitted.allObserved = yAll;
    fitted.allPredicted = predAll;

    return fitted;
  }

  function predict(features) {
    if (!fitted) throw new Error('Model not trained');
    const row = [1, ...FEATURE_DEFS.map(d => d.fn(features))];
    const z = row.map((v, j) => (v - fitted.means[j]) / fitted.stds[j]);
    const raw = z.reduce((s, v, j) => s + v * fitted.coef[j], 0);
    return Math.max(2, Math.min(99.5, raw));
  }

  function getFitted() { return fitted; }

  function localExplanation(p) {
    const notes = [];
    const y = p.yield.toFixed(1);

    if (p.type === 'cuaac') {
      if (p.cat > 5) {
        notes.push(`Increasing catalyst loading past 5 mol% offers diminishing returns due to copper aggregation and azide homocatalysis side-reactions — the model damped its contribution accordingly.`);
      } else if (p.cat < 0.5) {
        notes.push(`Near-zero Cu(I) loading starves the catalytic cycle; even a few mol% of CuI with a ligand should lift the yield substantially.`);
      } else {
        notes.push(`The chosen ${p.cat.toFixed(1)} mol% Cu(I) sits in the productive regime, where the copper–acetylide cycle turns over cleanly without aggregation.`);
      }
    } else {
      notes.push(`SPAAC needs no catalyst: ring strain alone (~18 kcal/mol in cyclooctyne) drives the [3+2] cycloaddition, so the model ignores copper loading entirely.`);
    }

    if (p.temp > 80) {
      notes.push(`At ${p.temp.toFixed(0)} °C, azide decomposition and alkyne oligomerisation start to compete, which pulls the prediction below its peak.`);
    } else if (p.temp < 28) {
      notes.push(`At ${p.temp.toFixed(0)} °C the activation barrier is only partially crossed — click reactions of this type generally warm up sharply between 40 and 70 °C.`);
    } else {
      notes.push(`${p.temp.toFixed(0)} °C is close to the kinetic optimum identified across the USPTO/ORD-style training examples for this reaction class.`);
    }

    if (p.pol > 55 && p.type === 'cuaac') {
      notes.push(`Very polar media can sequester Cu(I) in unproductive solvated forms; t-BuOH/H₂O or DMF would usually do better here.`);
    } else if (p.conc > 0.7) {
      notes.push(`High concentration risks intermolecular azide–alkyne polymerisation; diluting toward 0.2–0.4 M often recovers several yield points.`);
    } else if (p.time < 6) {
      notes.push(`The short ${p.time} h window may leave conversion incomplete — extending time helps, but with diminishing gains after ~12 h.`);
    }

    return `Predicted yield: ${y}%. ${notes.join(' ')}`;
  }

  function buildGeminiPrompt(p) {
    return [
      'You are the lab assistant inside "Click Lab Simulator", a teaching app built by IIT Madras students.',
      'A browser-side regression model just predicted a click-reaction yield. Write a concise, precise lab note (2–3 sentences, plain text, no markdown headers) explaining WHY this yield occurred given the parameters, and give one concrete optimisation tip.',
      '',
      `Reaction type: ${p.type === 'cuaac' ? 'CuAAC (copper-catalysed azide–alkyne cycloaddition)' : 'SPAAC (strain-promoted, copper-free)'}`,
      `Azide SMILES: ${p.azide}`,
      `Alkyne SMILES: ${p.alkyne}`,
      `Temperature: ${p.temp} °C`,
      `Catalyst loading: ${p.type === 'cuaac' ? p.cat + ' mol% CuI' : 'none (SPAAC)'}`,
      `Solvent: ${p.solvent} (dielectric ≈ ${p.pol})`,
      `Concentration: ${p.conc} M`,
      `Time: ${p.time} h`,
      `Model-predicted yield: ${p.yield.toFixed(1)}%`,
      '',
      'Keep it under 70 words. Sound like a chemist talking to a student.'
    ].join('\n');
  }

  return { train, predict, getFitted, localExplanation, buildGeminiPrompt, FEATURE_DEFS };
})();
