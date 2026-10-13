window.ClickLab = window.ClickLab || {};

ClickLab.sandbox = (() => {

  const canvas = () => document.getElementById('cell-canvas');

  let ctx = null;
  let W = 960, H = 600;
  let proteins = [];
  let target = null;
  let probes = [];
  let raf = null;
  let glow = 0;
  let bound = 0;
  let running = false;

  const CELL = { cx: 480, cy: 300, rx: 340, ry: 230 };

  function rand(a, b) { return a + Math.random() * (b - a); }

  function inEllipse(x, y, pad = 0) {
    const dx = (x - CELL.cx) / (CELL.rx - pad);
    const dy = (y - CELL.cy) / (CELL.ry - pad);
    return dx * dx + dy * dy <= 1;
  }

  function randomInside(pad = 30) {
    let x, y;
    do {
      x = rand(CELL.cx - CELL.rx + pad, CELL.cx + CELL.rx - pad);
      y = rand(CELL.cy - CELL.ry + pad, CELL.cy + CELL.ry - pad);
    } while (!inEllipse(x, y, pad));
    return { x, y };
  }

  function makeProtein() {
    const { x, y } = randomInside(40);
    return {
      x, y,
      r: rand(5, 11),
      vx: rand(-0.35, 0.35),
      vy: rand(-0.35, 0.35),
      phase: rand(0, Math.PI * 2)
    };
  }

  function reset() {
    const c = canvas();
    W = c.width; H = c.height;
    CELL.cx = W / 2; CELL.cy = H / 2;
    CELL.rx = W * 0.36; CELL.ry = H * 0.38;

    proteins = Array.from({ length: 42 }, makeProtein);
    const t = randomInside(60);
    target = {
      x: t.x, y: t.y,
      r: 14,
      vx: rand(-0.22, 0.22),
      vy: rand(-0.22, 0.22),
      phase: rand(0, Math.PI * 2),
      boundProbes: []
    };
    probes = [];
    glow = 0;
    bound = 0;
    document.getElementById('bound-count').textContent = '0';
    document.getElementById('probe-total').textContent = '0';
    const st = document.getElementById('sandbox-status');
    st.textContent = 'Cell at rest · target protein carries an azide (N₃) handle';
    st.classList.remove('flash');
  }

  function injectProbe() {
    if (bound >= 3) return;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const ang = rand(0, Math.PI * 2);
      const px = CELL.cx + Math.cos(ang) * (CELL.rx + 30);
      const py = CELL.cy + Math.sin(ang) * (CELL.ry + 20);
      probes.push({
        x: px, y: py,
        vx: Math.cos(ang) * -rand(0.6, 1.4) + rand(-0.4, 0.4),
        vy: Math.sin(ang) * -rand(0.6, 1.4) + rand(-0.4, 0.4),
        r: 6,
        bound: false,
        alpha: 1,
        trail: []
      });
    }
    const st = document.getElementById('sandbox-status');
    st.textContent = `${n} DBCO–fluorophore probes injected — diffusing across the membrane…`;
    st.classList.add('flash');
    document.getElementById('probe-total').textContent = String(probes.length);
    if (!running) start();
  }

  function step() {
    for (const p of proteins) {
      p.phase += 0.015;
      p.x += p.vx + Math.sin(p.phase) * 0.15;
      p.y += p.vy + Math.cos(p.phase * 0.9) * 0.15;
      if (!inEllipse(p.x, p.y, p.r + 8)) {
        p.vx *= -1; p.vy *= -1;
        p.x += p.vx * 2; p.y += p.vy * 2;
      }
    }

    target.phase += 0.01;
    target.x += target.vx + Math.sin(target.phase) * 0.1;
    target.y += target.vy + Math.cos(target.phase * 0.8) * 0.1;
    if (!inEllipse(target.x, target.y, 30)) {
      target.vx *= -1; target.vy *= -1;
    }

    for (const pr of probes) {
      if (pr.bound) continue;

      const dxp = pr.x - target.x;
      const dyp = pr.y - target.y;
      const distT = Math.hypot(dxp, dyp);

      pr.age = (pr.age || 0) + 1;
      if (distT < 150 && bound < 3) {
        const pull = pr.age > 240 ? 0.42 : 0.30;
        pr.vx += (-dxp / distT) * pull;
        pr.vy += (-dyp / distT) * pull;
      } else if (pr.age > 360 && bound < 3) {
        pr.vx += (-dxp / distT) * 0.12;
        pr.vy += (-dyp / distT) * 0.12;
      }

      pr.trail.push({ x: pr.x, y: pr.y });
      if (pr.trail.length > 12) pr.trail.shift();

      pr.vx += rand(-0.12, 0.12);
      pr.vy += rand(-0.12, 0.12);
      pr.vx *= 0.97; pr.vy *= 0.97;

      const sp = Math.hypot(pr.vx, pr.vy);
      if (sp > 2.2) { pr.vx = pr.vx / sp * 2.2; pr.vy = pr.vy / sp * 2.2; }

      pr.x += pr.vx; pr.y += pr.vy;

      if (!inEllipse(pr.x, pr.y, 4)) {
        const nx = (pr.x - CELL.cx) / (CELL.rx - 4);
        const ny = (pr.y - CELL.cy) / (CELL.ry - 4);
        const nlen = Math.hypot(nx, ny) || 1;
        const dot = pr.vx * (nx / nlen) + pr.vy * (ny / nlen);
        pr.vx -= 2 * dot * (nx / nlen);
        pr.vy -= 2 * dot * (ny / nlen);
        pr.vx *= 0.75; pr.vy *= 0.75;
      }

      for (const pf of proteins) {
        const dx = pr.x - pf.x, dy = pr.y - pf.y;
        const d = Math.hypot(dx, dy);
        if (d < pr.r + pf.r + 2 && d > 0.01) {
          pr.vx += (dx / d) * 0.35;
          pr.vy += (dy / d) * 0.35;
        }
      }

      if (distT < target.r + pr.r + 4 && bound < 3) {
        pr.bound = true;
        bound++;
        target.boundProbes.push(pr);
        glow = Math.min(1, glow + 0.33);
        const st = document.getElementById('sandbox-status');
        st.textContent = `SPAAC click! Probe covalently bound to the azide handle · ${bound}/3 sites occupied`;
        st.classList.add('flash');
        document.getElementById('bound-count').textContent = String(bound);
      }
    }

    for (const pr of target.boundProbes) {
      const ang = target.boundProbes.indexOf(pr) * 2.1 + 0.5;
      pr.x = target.x + Math.cos(ang) * (target.r + 7);
      pr.y = target.y + Math.sin(ang) * (target.r + 7);
    }

    if (bound >= 3) glow = Math.min(1, glow + 0.004);
    else if (probes.length && probes.every(p => p.bound || Math.hypot(p.vx, p.vy) < 0.02)) {
      // probes settled unbound — keep drifting, no state change
    }
    glow *= 0.9995;
  }

  function draw() {
    if (!ctx) ctx = canvas().getContext('2d');

    const g = ctx.createRadialGradient(CELL.cx, CELL.cy, 40, CELL.cx, CELL.cy, CELL.rx + 60);
    g.addColorStop(0, `rgba(16, 52, 66, ${0.55 + glow * 0.35})`);
    g.addColorStop(0.72, `rgba(10, 28, 42, ${0.5 + glow * 0.3})`);
    g.addColorStop(1, 'rgba(4, 7, 15, 0.9)');
    ctx.fillStyle = '#04070f';
    ctx.fillRect(0, 0, W, H);

    drawStars();

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(CELL.cx, CELL.cy, CELL.rx, CELL.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    if (glow > 0.02) {
      const fg = ctx.createRadialGradient(target.x, target.y, 10, target.x, target.y, CELL.rx);
      fg.addColorStop(0, `rgba(45, 212, 191, ${0.28 * glow})`);
      fg.addColorStop(1, 'rgba(45, 212, 191, 0)');
      ctx.fillStyle = fg;
      ctx.fill();
    }

    ctx.lineWidth = 5;
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.55 + glow * 0.4})`;
    ctx.shadowColor = 'rgba(56,189,248,0.8)';
    ctx.shadowBlur = 16 + glow * 26;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.beginPath();
    ctx.ellipse(CELL.cx, CELL.cy, CELL.rx - 9, CELL.ry - 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    drawNucleus();

    for (const pf of proteins) {
      ctx.beginPath();
      ctx.arc(pf.x, pf.y, pf.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 116, 139, ${0.55 + glow * 0.2})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    drawTarget();

    for (const pr of probes) drawProbe(pr);

    if (glow > 0.05) {
      ctx.fillStyle = `rgba(45, 212, 191, ${0.05 * glow})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawStars() {
    ctx.save();
    for (let i = 0; i < 30; i++) {
      const x = (i * 137.5) % W;
      const y = (i * 89.3) % H;
      ctx.fillStyle = `rgba(148, 163, 184, ${0.05 + (i % 5) * 0.012})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.restore();
  }

  function drawNucleus() {
    const nx = CELL.cx + 70, ny = CELL.cy + 20, nr = CELL.ry * 0.38;
    ctx.beginPath();
    ctx.ellipse(nx, ny, nr * 1.15, nr, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(30, 27, 75, ${0.55 + glow * 0.25})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(167, 139, 250, ${0.4 + glow * 0.3})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = `rgba(167, 139, 250, ${0.12 + glow * 0.15})`;
    ctx.font = '600 13px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NUCLEUS', nx, ny + 4);
  }

  function drawTarget() {
    const pulse = 1 + Math.sin(performance.now() / 400) * 0.08;
    ctx.save();
    ctx.shadowColor = bound > 0 ? 'rgba(45,212,191,0.9)' : 'rgba(244,114,182,0.8)';
    ctx.shadowBlur = bound > 0 ? 22 : 12;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.r * pulse, 0, Math.PI * 2);
    ctx.fillStyle = bound > 0 ? 'rgba(45, 212, 191, 0.85)' : 'rgba(244, 114, 182, 0.8)';
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(target.x + target.r, target.y);
    ctx.lineTo(target.x + target.r + 14, target.y - 10);
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(244, 114, 182, 0.95)';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(bound > 0 ? 'N₃·SPAAC' : 'N₃', target.x + target.r + 17, target.y - 8);
  }

  function drawProbe(pr) {
    if (pr.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(pr.trail[0].x, pr.trail[0].y);
      for (let i = 1; i < pr.trail.length; i++) ctx.lineTo(pr.trail[i].x, pr.trail[i].y);
      ctx.strokeStyle = `rgba(45, 212, 191, ${pr.bound ? 0.05 : 0.2})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.save();
    ctx.shadowColor = 'rgba(45, 212, 191, 1)';
    ctx.shadowBlur = pr.bound ? 18 : 14;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(94, 234, 212, 0.95)';
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(pr.x - 1.5, pr.y - 1.5, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(240, 255, 252, 0.9)';
    ctx.fill();
  }

  function loop() {
    step();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (raf) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  function init() {
    ctx = canvas().getContext('2d');
    reset();
    draw();
    document.getElementById('btn-inject').addEventListener('click', injectProbe);
    document.getElementById('btn-reset-cell').addEventListener('click', () => {
      stop();
      reset();
      draw();
    });
  }

  function onShow() { start(); }
  function onHide() { stop(); }

  return { init, onShow, onHide };
})();
