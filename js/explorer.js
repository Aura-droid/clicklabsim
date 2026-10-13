window.ClickLab = window.ClickLab || {};

ClickLab.explorer = (() => {

  let chartsBuilt = false;

  const GRID = 'rgba(138, 160, 189, 0.14)';
  const TICK = '#8aa0bd';

  function chartDefaults() {
    Chart.defaults.color = TICK;
    Chart.defaults.borderColor = GRID;
    Chart.defaults.font.family = "'Rajdhani', sans-serif";
    Chart.defaults.font.size = 13;
    Chart.defaults.font.weight = '600';
  }

  function build() {
    if (chartsBuilt) return;
    const fitted = ClickLab.model.getFitted();
    if (!fitted) return;
    chartsBuilt = true;

    chartDefaults();

    const m = fitted.testMetrics;
    document.getElementById('metric-r2').textContent = m.r2.toFixed(3);
    document.getElementById('metric-mae').textContent = '±' + m.mae.toFixed(2);
    document.getElementById('metric-rmse').textContent = m.rmse.toFixed(2);
    document.getElementById('metric-n').textContent = fitted.allObserved.length;

    const scatterData = fitted.testRows.map((r, i) => ({ x: fitted.predTe[i], y: r.yield }));

    new Chart(document.getElementById('chart-scatter'), {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Test reactions',
            data: scatterData,
            backgroundColor: 'rgba(34, 211, 238, 0.65)',
            borderColor: 'rgba(34, 211, 238, 0.95)',
            pointRadius: 5,
            pointHoverRadius: 7
          },
          {
            label: 'Perfect prediction',
            type: 'line',
            data: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
            borderColor: 'rgba(167, 139, 250, 0.8)',
            borderDash: [8, 6],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { usePointStyle: true, boxHeight: 8 } },
          tooltip: {
            callbacks: {
              label: ctx => `pred ${ctx.parsed.x.toFixed(1)}% · obs ${ctx.parsed.y.toFixed(1)}%`
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Predicted yield (%)' }, min: 0, max: 100, grid: { color: GRID } },
          y: { title: { display: true, text: 'Observed yield (%)' }, min: 0, max: 100, grid: { color: GRID } }
        }
      }
    });

    const residuals = scatterData.map(p => p.y - p.x);
    const bins = [];
    for (let b = -20; b < 20; b += 2.5) bins.push({ start: b, count: 0 });
    for (const r of residuals) {
      const idx = Math.min(bins.length - 1, Math.max(0, Math.floor((r + 20) / 2.5)));
      bins[idx].count++;
    }

    new Chart(document.getElementById('chart-residual'), {
      type: 'bar',
      data: {
        labels: bins.map(b => b.start.toFixed(1)),
        datasets: [{
          label: 'Reactions per residual bin',
          data: bins.map(b => b.count),
          backgroundColor: bins.map(b =>
            b.start > 7.5 || b.start < -7.5 ? 'rgba(251, 113, 133, 0.7)' : 'rgba(126, 247, 212, 0.65)'
          ),
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} reactions · residual ≥ ${ctx.label}` } }
        },
        scales: {
          x: { title: { display: true, text: 'Residual (obs − pred, yield points)' }, grid: { display: false } },
          y: { title: { display: true, text: 'Count' }, grid: { color: GRID }, ticks: { precision: 0 } }
        }
      }
    });

    const imp = fitted.importance.slice(0, 10);
    new Chart(document.getElementById('chart-importance'), {
      type: 'bar',
      data: {
        labels: imp.map(d => d.label),
        datasets: [{
          label: '|standardised coefficient|',
          data: imp.map(d => d.abs),
          backgroundColor: imp.map((d, i) =>
            d.weight >= 0
              ? `rgba(34, 211, 238, ${0.85 - i * 0.06})`
              : `rgba(251, 113, 133, ${0.85 - i * 0.06})`
          ),
          borderRadius: 5
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const d = imp[ctx.dataIndex];
                return ` weight ${d.weight.toFixed(2)} (${d.weight >= 0 ? 'raises' : 'lowers'} yield)`;
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Influence on predicted yield' }, grid: { color: GRID } },
          y: { grid: { display: false } }
        }
      }
    });

    const top = fitted.importance.slice(0, 3).map(d => d.label);
    document.getElementById('model-card-body').innerHTML = `
      <p>The predictor is a <strong>ridge-regularised linear regression</strong> fitted entirely in your browser on
      <strong>${fitted.allObserved.length} click-reaction records</strong> styled after USPTO / ORD reaction parameters
      (temperature, catalyst loading, solvent polarity, concentration, time, reaction class), with hand-crafted
      interaction and non-linear features. It is a deliberately interpretable teaching model — not a black box.</p>
      <ul>
        <li><strong>Train R²:</strong> ${fitted.trainMetrics.r2.toFixed(3)} &nbsp;·&nbsp; <strong>Test R²:</strong> ${m.r2.toFixed(3)}
            &nbsp;·&nbsp; <strong>Test MAE:</strong> ±${m.mae.toFixed(2)} yield points &nbsp;·&nbsp; <strong>Test RMSE:</strong> ${m.rmse.toFixed(2)}</li>
        <li><strong>Split:</strong> seeded 80/20 shuffle — the scatter plot above shows only held-out reactions.</li>
        <li><strong>Top features:</strong> ${top.join(', ')}. Standardised coefficients make features directly comparable;
            red bars would indicate a feature that lowers yield.</li>
        <li><strong>Honest limits:</strong> yields come from a literature-informed generative process, so the metrics measure
            recovery of that process — a demo of proper evaluation hygiene, not a production yield oracle.</li>
      </ul>`;
  }

  function init() { /* charts are built lazily on first screen show */ }

  return { init, build };
})();
