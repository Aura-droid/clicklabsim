window.ClickLab = window.ClickLab || {};

ClickLab.data = (() => {

  const REACTIONS = {
    cuaac: {
      id: 'cuaac',
      label: 'CuAAC',
      long: 'Cu(I)-catalysed Azide–Alkyne Cycloaddition',
      catalystLabel: 'CuI catalyst loading',
      azide: 'Cc1ccccc1CN=[N+]=[N-]',
      alkyne: 'Cc1ccccc1C#C',
      product: 'n1(CCc2ccccc2)cc(-c2ccccc2)nn1'
    },
    spaac: {
      id: 'spaac',
      label: 'SPAAC',
      long: 'Strain-Promoted Azide–Alkyne Cycloaddition',
      catalystLabel: 'Catalyst loading (n/a for SPAAC)',
      azide: 'OCCN=[N+]=[N-]',
      alkyne: 'C1CCCCC#CC1',
      product: 'N1(CCO)N=NC2=CCCCCCC12'
    }
  };

  const PRESETS = [
    { id: 'bz-phenyl', label: 'Benzyl azide + Phenylacetylene', rxn: 'cuaac',
      azide: 'Cc1ccccc1CN=[N+]=[N-]', alkyne: 'Cc1ccccc1C#C',
      product: 'n1(CCc2ccccc2)cc(-c2ccccc2)nn1' },
    { id: 'pg-alkyne', label: 'Phenyl azide + Phenylacetylene', rxn: 'cuaac',
      azide: 'c1ccccc1N=[N+]=[N-]', alkyne: 'C#Cc1ccccc1',
      product: 'n1(-c2ccccc2)cc(-c2ccccc2)nn1' },
    { id: 'sugar', label: 'Azidoacetate + Phenylacetylene', rxn: 'cuaac',
      azide: 'CCOC(=O)CN=[N+]=[N-]',
      alkyne: 'C#Cc1ccccc1',
      product: 'n1(CC(=O)OCC)cc(-c2ccccc2)nn1' },
    { id: 'dbco-azide', label: 'Cyclooctyne + Benzyl azide (SPAAC)', rxn: 'spaac',
      azide: 'Cc1ccccc1CN=[N+]=[N-]', alkyne: 'C1CCCCC#CC1',
      product: 'N1(CCc2ccccc2)N=NC2=CCCCCCC12' },
    { id: 'octyne-azidoetoh', label: 'Cyclooctyne + Azidoethanol (SPAAC)', rxn: 'spaac',
      azide: 'OCCN=[N+]=[N-]', alkyne: 'C1CCCCC#CC1',
      product: 'N1(CCO)N=NC2=CCCCCCC12' }
  ];

  const SOLVENTS = [
    { id: 'dmso',    label: 'DMSO',              polarity: 46.7, hint: 'Polar aprotic — excellent for CuAAC, dissolves most organic azides.' },
    { id: 'dmf',     label: 'DMF',               polarity: 38.3, hint: 'Classic CuAAC solvent; good copper complex solubility.' },
    { id: 'water',   label: 'Water',             polarity: 80.1, hint: 'Green & ideal for SPAAC; copper catalysts need ligands here.' },
    { id: 'tbuh',    label: 't-BuOH / H₂O',     polarity: 35.0, hint: 'Sharpless "click" standard — mixed aqueous protocol, very high yields.' },
    { id: 'meoh',    label: 'MeOH',              polarity: 32.7, hint: 'Protic; fine for SPAAC, slightly slower CuAAC kinetics.' },
    { id: 'thf',     label: 'THF',               polarity:  7.6, hint: 'Low polarity — slower click kinetics, risky for copper speciation.' },
    { id: 'dcm',     label: 'DCM',               polarity:  9.1, hint: 'Non-polar aprotic — usable, but not the solvent of choice.' }
  ];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function groundTruth(f, rnd) {
    const temp = f.temp, cat = f.cat, pol = f.pol, conc = f.conc, time = f.time, type = f.type;
    let y = 70;
    y += 0.55 * (temp - 25) - 0.010 * Math.pow(temp - 25, 2);
    if (type === 1) {
      y += 9.0 * Math.log1p(cat) - 1.6 * Math.pow(cat, 1.35);
      y += 0.08 * (temp - 25) * Math.log1p(cat);
      y -= 0.015 * Math.pow(pol - 38, 2);
    } else {
      y += 0.20 * (temp - 25);
      y -= 0.008 * Math.pow(pol - 70, 2);
      y += 4;
    }
    y += 4.5 * Math.log1p(2 * time) - 4.0;
    y -= 14 * Math.max(0, conc - 0.4);
    const noise = (rnd() + rnd() + rnd() - 1.5) * 5.5;
    return Math.max(12, Math.min(99, y + noise));
  }

  function samplePoint(rnd) {
    const type = rnd() < 0.62 ? 1 : 0;
    const temp = 20 + rnd() * 80;
    const cat = type === 1 ? Math.pow(rnd(), 1.4) * 10 : 0;
    const pol = type === 1
      ? 7 + rnd() * 40
      : 30 + rnd() * 52;
    const conc = 0.05 + rnd() * 0.95;
    const time = 2 + rnd() * 46;
    const f = { temp, cat, pol, conc, time, type };
    return { features: f, yield: groundTruth(f, rnd) };
  }

  function buildDataset(n = 220) {
    const rnd = mulberry32(20261013);
    const rows = [];
    for (let i = 0; i < n; i++) rows.push(samplePoint(rnd));
    return rows;
  }

  return { REACTIONS, PRESETS, SOLVENTS, buildDataset, mulberry32 };
})();
