(() => {
  const canvas = document.getElementById("particles");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  const ACCENT = "214, 255, 58";
  const WARM = "242, 235, 224";

  let width = 0;
  let height = 0;
  let particles = [];
  let raf = 0;
  let intensity = 0.55;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    const count = Math.min(90, Math.floor((width * height) / 18000));
    particles = Array.from({ length: count }, () => spawn());
  }

  function spawn(fromEdge = false) {
    const speed = 0.15 + Math.random() * 0.45;
    const angle = Math.random() * Math.PI * 2;
    return {
      x: fromEdge ? Math.random() * width : Math.random() * width,
      y: fromEdge ? Math.random() * height : Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 0.6 + Math.random() * 1.4,
      accent: Math.random() > 0.82,
      life: Math.random(),
    };
  }

  function tick() {
    ctx.clearRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.48;
    const clearR = Math.min(width, height) * 0.22;

    for (const p of particles) {
      p.x += p.vx * intensity;
      p.y += p.vy * intensity;
      p.life += 0.002;

      if (p.x < -4 || p.x > width + 4 || p.y < -4 || p.y > height + 4) {
        Object.assign(p, spawn(true));
      }

      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const fade = dist < clearR ? Math.max(0.08, (dist / clearR) * 0.55) : 0.55 + 0.35 * Math.sin(p.life * 4);
      const rgb = p.accent ? ACCENT : WARM;

      ctx.beginPath();
      ctx.fillStyle = `rgba(${rgb}, ${fade * (p.accent ? 0.85 : 0.35)})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // sparse connecting ticks — technical, not webby glow net
    ctx.lineWidth = 0.6;
    for (let i = 0; i < particles.length; i += 3) {
      const a = particles[i];
      const b = particles[(i + 7) % particles.length];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 140 * 140) {
        const alpha = (1 - Math.sqrt(d2) / 140) * 0.12 * intensity;
        ctx.strokeStyle = `rgba(${ACCENT}, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    raf = requestAnimationFrame(tick);
  }

  window.setParticleIntensity = (value) => {
    intensity = Math.max(0.2, Math.min(1.4, value));
  };

  window.addEventListener("resize", resize);
  resize();
  tick();
})();
