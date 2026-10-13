window.ClickLab = window.ClickLab || {};

(() => {
  const screens = {
    lab: document.getElementById('screen-lab'),
    sandbox: document.getElementById('screen-sandbox'),
    explorer: document.getElementById('screen-explorer')
  };

  function show(name) {
    Object.entries(screens).forEach(([key, el]) => el.classList.toggle('active', key === name));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
    if (name === 'sandbox') ClickLab.sandbox.onShow(); else ClickLab.sandbox.onHide();
    if (name === 'explorer') ClickLab.explorer.build();
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => show(btn.dataset.screen));
  });

  const rows = ClickLab.data.buildDataset(220);
  ClickLab.model.train(rows);
  ClickLab.lab.init();
  ClickLab.sandbox.init();
  ClickLab.explorer.init();
})();
