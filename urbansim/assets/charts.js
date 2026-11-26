/* Project template · small SVG chart kit (no dependencies).
   Charts read colors from CSS tokens, redraw on resize and on theme change, and share one tooltip.
   UC.line · UC.forest · UC.bars · UC.scatter · UC.streets */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ---------- tooltip ----------
  let tip;
  function tooltip() {
    if (!tip) { tip = document.createElement("div"); tip.className = "tooltip"; tip.setAttribute("role", "status"); document.body.appendChild(tip); }
    return tip;
  }
  function showTip(html, ev) {
    const t = tooltip(); t.innerHTML = html; t.classList.add("on");
    const pad = 14, w = t.offsetWidth, h = t.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = ev.clientY - h - pad;
    t.style.left = Math.max(8, x) + "px"; t.style.top = Math.max(8, y) + "px";
  }
  function hideTip() { if (tip) tip.classList.remove("on"); }
  const row = (k, v) => `<div class="t-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;

  // ---------- scales ----------
  function niceStep(span, count) {
    const raw = span / Math.max(1, count), mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    return (r >= 5 ? 10 : r >= 2 ? 5 : r >= 1 ? 2 : 1) * mag;
  }
  function linear(d0, d1, r0, r1, count) {
    if (d0 === d1) { d0 -= 1; d1 += 1; }
    const step = niceStep(d1 - d0, count || 5);
    const lo = Math.floor(d0 / step) * step, hi = Math.ceil(d1 / step) * step;
    const f = (v) => r0 + ((v - lo) / (hi - lo)) * (r1 - r0);
    f.ticks = []; for (let v = lo; v <= hi + step / 2; v += step) f.ticks.push(+v.toFixed(10));
    f.domain = [lo, hi];
    return f;
  }
  function logScale(d0, d1, r0, r1) {
    const lo = Math.pow(10, Math.floor(Math.log10(d0))), hi = Math.pow(10, Math.ceil(Math.log10(d1)));
    const f = (v) => r0 + ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (r1 - r0);
    f.ticks = []; for (let p = lo; p <= hi * 1.001; p *= 10) for (const m of [1, 2, 5]) if (p * m >= lo && p * m <= hi) f.ticks.push(p * m);
    f.domain = [lo, hi];
    return f;
  }
  const fixedScale = (d0, d1, r0, r1) => { const f = (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0); f.domain = [d0, d1]; return f; };

  // ---------- svg helpers ----------
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, x, y, s, attrs) { const t = el("text", Object.assign({ x, y }, attrs || {}), parent); t.textContent = s; return t; }
  const color = (c) => (c && c.startsWith("--") ? css(c) : c);

  // Each chart is a function (host, width) -> svg; mount() handles resize and theme changes.
  const mounted = new Set();
  function mount(host, draw) {
    host.classList.add("chart");
    const render = () => {
      const w = Math.max(260, host.clientWidth || 600);
      host.querySelector("svg") && host.querySelector("svg").remove();
      host.appendChild(draw(w));
    };
    host.__render = render;
    mounted.add(host);
    if (window.ResizeObserver) {
      let last = 0;
      new ResizeObserver(() => { const w = host.clientWidth; if (Math.abs(w - last) > 4) { last = w; render(); } }).observe(host);
    }
    render();
  }
  function redrawAll() { for (const h of mounted) if (h.isConnected && h.clientWidth) h.__render(); }

  function frame(w, h, m) {
    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: "img" });
    return { svg, x0: m.l, x1: w - m.r, y0: h - m.b, y1: m.t };
  }
  function axes(svg, f, xs, ys, o) {
    const g = el("g", { class: "grid" }, svg), ax = el("g", { class: "axis" }, svg);
    for (const v of ys.ticks || []) {
      const y = ys(v); if (y < f.y1 - 1 || y > f.y0 + 1) continue;
      el("line", { x1: f.x0, x2: f.x1, y1: y, y2: y }, g);
      text(ax, f.x0 - 8, y + 4, o.yFmt(v), { "text-anchor": "end" });
    }
    for (const v of xs.ticks || []) {
      const x = xs(v); if (x < f.x0 - 1 || x > f.x1 + 1) continue;
      if (o.xGrid) el("line", { x1: x, x2: x, y1: f.y1, y2: f.y0 }, g);
      text(ax, x, f.y0 + 18, o.xFmt(v), { "text-anchor": "middle" });
    }
    el("line", { x1: f.x0, x2: f.x1, y1: f.y0, y2: f.y0 }, ax);
    if (o.xLabel) text(ax, (f.x0 + f.x1) / 2, f.y0 + 38, o.xLabel, { "text-anchor": "middle" });
    if (o.yLabel) text(ax, f.x0 - 8, f.y1 - 12, o.yLabel, { "text-anchor": "start", x: 0 });
  }

  // ---------- line with CI band ----------
  function line(host, o) {
    const xFmt = o.x && o.x.fmt || ((v) => String(v)), yFmt = o.y && o.y.fmt || ((v) => String(+v.toFixed(2)));
    mount(host, (w) => {
      const h = o.height || 280, f = frame(w, h, { l: 48, r: 16, t: 26, b: o.x && o.x.label ? 48 : 30 });
      const pts = o.series.flatMap((s) => s.points);
      const xsAll = pts.map((p) => p.x), ysAll = pts.flatMap((p) => [p.y, p.hi ?? p.y, p.lo ?? p.y]).concat((o.hlines || []).map((l) => l.y));
      const xs = o.x && o.x.log ? logScale(Math.min(...xsAll), Math.max(...xsAll), f.x0, f.x1) : fixedScale(Math.min(...xsAll), Math.max(...xsAll), f.x0, f.x1);
      if (!xs.ticks) xs.ticks = linear(xs.domain[0], xs.domain[1], 0, 1, Math.max(3, Math.floor(w / 90))).ticks.filter((v) => v >= xs.domain[0] && v <= xs.domain[1]);
      const yMin = o.y && o.y.min !== undefined ? o.y.min : Math.min(0, ...ysAll);
      const ys = linear(yMin, Math.max(...ysAll) * 1.04, f.y0, f.y1, 5);
      axes(f.svg, f, xs, ys, { xFmt, yFmt, xLabel: o.x && o.x.label, yLabel: o.y && o.y.label });
      for (const s of o.series) {
        const c = color(s.color), sp = s.points.filter((p) => Number.isFinite(p.y));
        if (sp.some((p) => p.lo !== undefined)) {
          const up = sp.map((p) => `${xs(p.x)},${ys(p.hi)}`), dn = sp.slice().reverse().map((p) => `${xs(p.x)},${ys(p.lo)}`);
          el("polygon", { points: up.concat(dn).join(" "), fill: c, opacity: 0.16 }, f.svg);
        }
        el("polyline", { points: sp.map((p) => `${xs(p.x)},${ys(p.y)}`).join(" "), fill: "none", stroke: c, "stroke-width": 2, "stroke-linejoin": "round", "stroke-dasharray": s.dash ? "5 4" : null }, f.svg);
        if (s.marker !== false) for (const p of sp) el("circle", { cx: xs(p.x), cy: ys(p.y), r: 3.2, fill: c, stroke: css("--surface"), "stroke-width": 1.5 }, f.svg);
      }
      for (const l of o.hlines || []) {
        const y = ys(l.y), c = color(l.color || "--bad");
        el("line", { x1: f.x0, x2: f.x1, y1: y, y2: y, stroke: c, "stroke-dasharray": "5 4", "stroke-width": 1.5 }, f.svg);
        text(f.svg, f.x1, y - 6, l.label, { "text-anchor": "end", style: `fill:${c}` });
      }
      for (const l of o.vlines || []) {
        if (l.x < xs.domain[0] || l.x > xs.domain[1]) continue;
        const x = xs(l.x), c = color(l.color || "--accent");
        el("line", { x1: x, x2: x, y1: f.y1, y2: f.y0, stroke: c, "stroke-width": 1.5, "stroke-dasharray": l.dash ? "3 3" : null }, f.svg);
        text(f.svg, x + 5, f.y1 + 10, l.label, { style: `fill:${c};font-weight:600` });
      }
      if (o.title) text(f.svg, 0, 14, o.title, { class: "title-text" });
      // crosshair + tooltip
      const xsU = [...new Set(xsAll)].sort((a, b) => a - b);
      const cross = el("line", { y1: f.y1, y2: f.y0, stroke: css("--axis"), "stroke-width": 1, opacity: 0 }, f.svg);
      const hit = el("rect", { x: f.x0, y: f.y1, width: f.x1 - f.x0, height: f.y0 - f.y1, fill: "transparent" }, f.svg);
      hit.addEventListener("mousemove", (ev) => {
        const r = f.svg.getBoundingClientRect(), mx = ((ev.clientX - r.left) / r.width) * w;
        let best = xsU[0]; for (const v of xsU) if (Math.abs(xs(v) - mx) < Math.abs(xs(best) - mx)) best = v;
        cross.setAttribute("x1", xs(best)); cross.setAttribute("x2", xs(best)); cross.setAttribute("opacity", 1);
        let html = `<div class="t-head">${esc((o.x && o.x.name) || "x")} = ${esc(xFmt(best))}</div>`;
        for (const s of o.series) {
          const p = s.points.find((q) => q.x === best); if (!p || !Number.isFinite(p.y)) continue;
          html += row(s.name, yFmt(p.y) + (p.lo !== undefined ? `  [${yFmt(p.lo)}, ${yFmt(p.hi)}]` : ""));
        }
        showTip(html, ev);
      });
      hit.addEventListener("mouseleave", () => { cross.setAttribute("opacity", 0); hideTip(); });
      f.svg.setAttribute("aria-label", o.aria || o.title || "line chart");
      return f.svg;
    });
  }

  // ---------- forest plot (estimate + CI per row) ----------
  function forest(host, o) {
    const fmt = o.fmt || ((v) => (v * 100).toFixed(1) + "%");
    mount(host, (w) => {
      const rowH = o.rowH || 34, labelW = Math.min(o.labelW || 330, w * 0.48), h = 40 + o.rows.length * rowH + 30;
      const f = frame(w, h, { l: labelW, r: 20, t: 26, b: 34 });
      const vals = o.rows.flatMap((r) => [r.lo, r.hi]).concat(o.band || [], [0]);
      const ext = Math.max(...vals.map(Math.abs)) * 1.12;
      const xs = linear(-ext, ext, f.x0, f.x1, Math.max(4, Math.floor((w - labelW) / 80)));
      const g = el("g", { class: "grid" }, f.svg);
      for (const v of xs.ticks) { el("line", { x1: xs(v), x2: xs(v), y1: f.y1, y2: f.y0 }, g); text(f.svg, xs(v), f.y0 + 18, fmt(v), { "text-anchor": "middle" }); }
      if (o.band) el("rect", { x: xs(o.band[0]), width: xs(o.band[1]) - xs(o.band[0]), y: f.y1, height: f.y0 - f.y1, fill: css("--neutral"), opacity: 0.14 }, f.svg);
      el("line", { x1: xs(0), x2: xs(0), y1: f.y1, y2: f.y0, stroke: css("--axis"), "stroke-width": 1.2 }, f.svg);
      if (o.xLabel) text(f.svg, (f.x0 + f.x1) / 2, h - 2, o.xLabel, { "text-anchor": "middle" });
      if (o.leftNote) text(f.svg, xs(-ext) + 4, f.y1 - 8, o.leftNote, {});
      if (o.rightNote) text(f.svg, xs(ext) - 4, f.y1 - 8, o.rightNote, { "text-anchor": "end" });
      o.rows.forEach((r, i) => {
        const y = f.y1 + 14 + i * rowH, c = color(r.color || ({ pass: "--good", fail: "--bad", tie: "--neutral" })[r.status] || "--s1");
        const g2 = el("g", {}, f.svg);
        el("rect", { x: 0, y: y - rowH / 2, width: w, height: rowH, fill: "transparent" }, g2);
        text(g2, 0, y + 1, r.label, { class: "label-strong", style: "font-size:12.5px" });
        if (r.sub) text(g2, 0, y + 14, r.sub, { style: "font-size:10.5px" });
        el("line", { x1: xs(r.lo), x2: xs(r.hi), y1: y, y2: y, stroke: c, "stroke-width": 2.2, "stroke-linecap": "round" }, g2);
        el("circle", { cx: xs(r.est), cy: y, r: 5, fill: c, stroke: css("--surface"), "stroke-width": 2 }, g2);
        g2.addEventListener("mousemove", (ev) => showTip(r.tip || `<div class="t-head">${esc(r.label)}</div>${row("estimate", fmt(r.est))}${row("95% CI", `${fmt(r.lo)} to ${fmt(r.hi)}`)}`, ev));
        g2.addEventListener("mouseleave", hideTip);
      });
      f.svg.setAttribute("aria-label", o.aria || "forest plot");
      return f.svg;
    });
  }

  // ---------- horizontal bars with CI whiskers ----------
  function bars(host, o) {
    const fmt = o.fmt || ((v) => String(Math.round(v)));
    mount(host, (w) => {
      const rowH = o.rowH || 36, labelW = Math.min(o.labelW || 220, w * 0.42), h = 20 + o.rows.length * rowH + 34;
      const f = frame(w, h, { l: labelW, r: 46, t: 14, b: 34 });
      const mx = Math.max(...o.rows.map((r) => r.hi ?? r.value), ...(o.refs || []).map((r) => r.x)) * 1.05;
      const xs = linear(0, mx, f.x0, f.x1, Math.max(3, Math.floor((w - labelW) / 90)));
      const g = el("g", { class: "grid" }, f.svg);
      for (const v of xs.ticks) { if (xs(v) > f.x1 + 1) continue; el("line", { x1: xs(v), x2: xs(v), y1: f.y1, y2: f.y0 }, g); text(f.svg, xs(v), f.y0 + 18, fmt(v), { "text-anchor": "middle" }); }
      if (o.xLabel) text(f.svg, (f.x0 + f.x1) / 2, h - 2, o.xLabel, { "text-anchor": "middle" });
      o.rows.forEach((r, i) => {
        const y = f.y1 + 6 + i * rowH, bh = Math.min(18, rowH - 14), c = color(r.color || "--s1");
        const g2 = el("g", {}, f.svg);
        el("rect", { x: 0, y: y - 4, width: w, height: rowH, fill: "transparent" }, g2);
        text(g2, labelW - 12, y + bh / 2 + 4, r.label, { "text-anchor": "end", class: "label-strong", style: "font-size:12.5px" });
        el("rect", { x: f.x0, y, width: Math.max(1, xs(r.value) - f.x0), height: bh, rx: 3, fill: c, opacity: 0.88 }, g2);
        if (r.lo !== undefined) {
          const yy = y + bh / 2;
          el("line", { x1: xs(r.lo), x2: xs(r.hi), y1: yy, y2: yy, stroke: css("--ink"), "stroke-width": 1.5 }, g2);
          for (const v of [r.lo, r.hi]) el("line", { x1: xs(v), x2: xs(v), y1: yy - 5, y2: yy + 5, stroke: css("--ink"), "stroke-width": 1.5 }, g2);
        }
        text(g2, Math.max(xs(r.hi ?? r.value), xs(r.value)) + 8, y + bh / 2 + 4, fmt(r.value), { class: "label-strong" });
        g2.addEventListener("mousemove", (ev) => showTip(r.tip || `<div class="t-head">${esc(r.label)}</div>${row("value", fmt(r.value))}${r.lo !== undefined ? row("95% CI", `${fmt(r.lo)} to ${fmt(r.hi)}`) : ""}`, ev));
        g2.addEventListener("mouseleave", hideTip);
      });
      for (const ref of o.refs || []) {
        const x = xs(ref.x), c = color(ref.color || "--accent");
        el("line", { x1: x, x2: x, y1: f.y1 - 4, y2: f.y0, stroke: c, "stroke-width": 1.5, "stroke-dasharray": "4 3" }, f.svg);
        text(f.svg, x + 4, f.y1 + 2, ref.label, { style: `fill:${c};font-size:11px` });
      }
      f.svg.setAttribute("aria-label", o.aria || "bar chart");
      return f.svg;
    });
  }

  // ---------- scatter (optionally log-log, with a fitted line or identity diagonal) ----------
  function scatter(host, o) {
    const xFmt = o.x.fmt || ((v) => String(+v.toPrecision(3))), yFmt = o.y.fmt || ((v) => String(+v.toPrecision(3)));
    mount(host, (w) => {
      const h = o.height || 300, f = frame(w, h, { l: 52, r: 16, t: 26, b: 48 });
      const X = o.points.map((p) => p.x), Y = o.points.map((p) => p.y);
      let x0 = Math.min(...X), x1 = Math.max(...X), y0 = Math.min(...Y), y1 = Math.max(...Y);
      if (o.diag) { x0 = y0 = Math.min(x0, y0); x1 = y1 = Math.max(x1, y1); }
      const xs = o.x.log ? logScale(x0, x1, f.x0, f.x1) : linear(Math.min(0, x0), x1 * 1.05, f.x0, f.x1, 5);
      const ys = o.y.log ? logScale(y0, y1, f.y0, f.y1) : linear(Math.min(0, y0), y1 * 1.05, f.y0, f.y1, 5);
      axes(f.svg, f, xs, ys, { xFmt, yFmt, xLabel: o.x.label, yLabel: o.y.label, xGrid: true });
      if (o.diag) {
        const a = Math.max(xs.domain[0], ys.domain[0]), b = Math.min(xs.domain[1], ys.domain[1]);
        el("line", { x1: xs(a), y1: ys(a), x2: xs(b), y2: ys(b), stroke: css("--neutral"), "stroke-dasharray": "5 4", "stroke-width": 1.3 }, f.svg);
        text(f.svg, xs(b) - 4, ys(b) + 14, "y = x", { "text-anchor": "end" });
      }
      if (o.fit) {
        const [a, b] = [xs.domain[0], xs.domain[1]].map((v) => Math.max(v, Math.min(...X) * 0.8)).map((v, i) => (i ? Math.min(v, Math.max(...X) * 1.2) : v));
        const fy = (x) => Math.exp(o.fit.intercept) * Math.pow(x, o.fit.slope);
        el("line", { x1: xs(a), y1: ys(fy(a)), x2: xs(b), y2: ys(fy(b)), stroke: color(o.fit.color || "--accent"), "stroke-width": 2 }, f.svg);
        if (o.fit.label) text(f.svg, xs(b) - 4, ys(fy(b)) - 8, o.fit.label, { "text-anchor": "end", style: `fill:${color(o.fit.color || "--accent")};font-weight:600` });
      }
      if (o.ref) {
        const fy = (x) => Math.exp(o.ref.intercept) * Math.pow(x, o.ref.slope), a = Math.min(...X) * 0.8, b = Math.max(...X) * 1.2;
        el("line", { x1: xs(a), y1: ys(fy(a)), x2: xs(b), y2: ys(fy(b)), stroke: css("--neutral"), "stroke-width": 1.3, "stroke-dasharray": "5 4" }, f.svg);
        if (o.ref.label) text(f.svg, xs(a) + 4, ys(fy(a)) - 8, o.ref.label, {});
      }
      for (const p of o.points) {
        const c = color(p.color || "--s1");
        const dot = el("circle", { cx: xs(p.x), cy: ys(p.y), r: p.r || 5, fill: c, opacity: 0.9, stroke: css("--surface"), "stroke-width": 1.5 }, f.svg);
        dot.addEventListener("mousemove", (ev) => showTip(p.tip || `${row(o.x.label, xFmt(p.x))}${row(o.y.label, yFmt(p.y))}`, ev));
        dot.addEventListener("mouseleave", hideTip);
      }
      if (o.title) text(f.svg, 0, 14, o.title, { class: "title-text" });
      f.svg.setAttribute("aria-label", o.aria || "scatter plot");
      return f.svg;
    });
  }

  // ---------- street network thumbnail ----------
  function streets(host, o) {
    mount(host, (w) => {
      const [ex, ey] = o.extent, h = Math.round(Math.min(w * 1.05, Math.max(w * 0.6, (w * ey) / ex)));
      const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: "img", "aria-label": o.aria || "street network" });
      const pad = 8, s = Math.min((w - 2 * pad) / ex, (h - 2 * pad) / ey), ox = (w - ex * s) / 2, oy = (h - ey * s) / 2;
      const seg = o.segments; let d = "";
      for (let i = 0; i < seg.length; i += 4) d += `M${(ox + seg[i] * s).toFixed(1)} ${(oy + (ey - seg[i + 1]) * s).toFixed(1)}L${(ox + seg[i + 2] * s).toFixed(1)} ${(oy + (ey - seg[i + 3]) * s).toFixed(1)}`;
      el("path", { d, fill: "none", stroke: color(o.color || "--accent"), "stroke-width": o.width || 0.7, "stroke-linecap": "round", opacity: 0.85 }, svg);
      // scale bar
      const km = ex > 6 ? 2 : 1;
      el("line", { x1: pad + 4, x2: pad + 4 + km * s, y1: h - pad - 4, y2: h - pad - 4, stroke: css("--ink"), "stroke-width": 2 }, svg);
      text(svg, pad + 4, h - pad - 10, `${km} km`, { class: "label-strong" });
      return svg;
    });
  }

  window.UC = { line, forest, bars, scatter, streets, redrawAll, showTip, hideTip, css };
})();
