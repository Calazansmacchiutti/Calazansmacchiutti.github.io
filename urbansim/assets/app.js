/* UrbanSim dashboard: builds each tab from window.URBANSIM (written by `urbansim site`). */
(function () {
  "use strict";
  const D = window.URBANSIM;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const pct = (v, d = 1) => (v * 100).toFixed(d) + "%";
  const spct = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v * 100).toFixed(d) + "%";
  const num = (v, d = 0) => Number(v).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  const badge = (status, text) => `<span class="badge ${status}">${esc(text || status)}</span>`;
  const passBadge = (ok) => badge(ok ? "pass" : "fail", ok ? "pass" : "fail");
  const scen = (k) => (D.scenarios[k] || { label: k, desc: "" });
  const suite = (k) => (D.suites[k] || { label: k, desc: "" });
  const SLA = D.sla.ride_hailing || { p90_wait_min: 7, abandon_rate: 0.05 };
  const SERIES = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7", "--s8"];
  const BEH_ORDER = ["parado", "segue_demanda", "segue_oportunidade", "plataforma"];
  const BEH_COLOR = { parado: "--s1", segue_demanda: "--s2", segue_oportunidade: "--s3", plataforma: "--s4" };

  function h(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content; }
  function head(eyebrow, title, lede) {
    return `<div class="panel-head"><div><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2>${lede ? `<p class="lede">${lede}</p>` : ""}</div></div>`;
  }
  const sizing = (s, su, v) => D.sizing.find((r) => r.scenario === s && r.suite === su && (v === undefined || r.variant === v));
  const legend = (items) => `<div class="legend">${items.map((i) => `<span><i class="${i.box ? "box" : ""} ${i.dash ? "dash" : ""}" style="background:var(${i.color});color:var(${i.color})"></i>${esc(i.label)}</span>`).join("")}</div>`;
  function select(id, options, value) {
    return `<select id="${id}">${options.map((o) => `<option value="${esc(o.value)}"${o.value === value ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
  }
  const field = (label, control) => `<label class="field">${esc(label)}${control}</label>`;

  // ---------------------------------------------------------------- tabs
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const built = new Set();
  const builders = {};
  // Panels are "panel-<id>" while the hash is "#<id>": no element carries the hash id, so the browser never
  // jumps past the header to a panel on load.
  const key = (t) => t.getAttribute("aria-controls").replace(/^panel-/, "");
  const panel = (id) => document.getElementById("panel-" + id);
  function activate(id, focus) {
    const tab = tabs.find((t) => key(t) === id) || tabs[0];
    id = key(tab);
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1;
      panel(key(t)).hidden = !on;
    }
    if (!built.has(id) && builders[id]) { built.add(id); try { builders[id](panel(id)); } catch (e) { panel(id).innerHTML = `<p class="empty">This section could not be built: ${esc(e.message)}</p>`; console.error(e); } }
    if (focus) tab.focus();
    if (location.hash.slice(1) !== id) history.replaceState(null, "", "#" + id);
    const bar = tab.parentElement, l = tab.offsetLeft - bar.offsetLeft, r = l + tab.offsetWidth;
    if (l < bar.scrollLeft || r > bar.scrollLeft + bar.clientWidth) bar.scrollTo({ left: l - 24, behavior: "smooth" });
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => activate(key(t)));
    t.addEventListener("keydown", (e) => {
      const k = e.key, n = tabs.length;
      const j = k === "ArrowRight" ? (i + 1) % n : k === "ArrowLeft" ? (i - 1 + n) % n : k === "Home" ? 0 : k === "End" ? n - 1 : -1;
      if (j >= 0) { e.preventDefault(); activate(key(tabs[j]), true); }
    });
  });
  document.addEventListener("click", (e) => { const a = e.target.closest("[data-goto]"); if (a) { e.preventDefault(); activate(a.dataset.goto); window.scrollTo({ top: a.classList.contains("brand") ? 0 : $(".tabbar").offsetTop, behavior: "smooth" }); } });
  window.addEventListener("hashchange", () => activate(location.hash.slice(1)));
  const tabbar = $(".tabbar");
  const stick = () => tabbar.classList.toggle("stuck", tabbar.getBoundingClientRect().top <= 0 && window.scrollY > 0);
  window.addEventListener("scroll", stick, { passive: true }); stick();

  // ---------------------------------------------------------------- theme
  const toggle = $("#theme-toggle");
  function theme() { return document.documentElement.dataset.theme || "dark"; }
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("uc-theme", t); } catch (e) {}
    toggle.setAttribute("aria-label", t === "dark" ? "Switch to light theme" : "Switch to dark theme");
    for (const f of document.querySelectorAll("iframe.frame")) f.contentWindow && f.contentWindow.postMessage({ theme: t }, "*");
    UC.redrawAll();
  }
  toggle.addEventListener("click", () => setTheme(theme() === "dark" ? "light" : "dark"));
  setTheme(theme());

  $("#foot-meta").textContent = `Built ${D.meta.generated}${D.meta.commit ? " · commit " + D.meta.commit : ""} · every number on this page is read from a result file in the repository`;

  // ---------------------------------------------------------------- facts used in several tabs
  const base = sizing("base", "", "parado");
  const agentsOf = (s) => D.sizing.filter((r) => r.scenario === s && r.suite === "agentes");
  const baseAgents = agentsOf("base");
  const bestAgent = baseAgents.slice().sort((a, b) => a.n_star - b.n_star)[0];
  const stayAgent = baseAgents.find((r) => r.variant === "parado");
  const V = D.verification;
  const vChecks = V ? [
    { id: "V1", name: "Erlang C queue", ok: V.V1.every((r) => r.pass) },
    { id: "V2", name: "Search law", ok: V.V2.pass },
    { id: "V3", name: "Little's law", ok: V.V3.pass },
    { id: "V5", name: "Common random numbers", ok: V.V5.pass },
    { id: "V6a", name: "Equilibrium, static market", ok: V.V6a.pass },
    { id: "V6b", name: "Equilibrium in the simulation", ok: V.V6b.pass },
  ] : [];
  const N = D.nyc;
  const nycTests = N ? [
    { id: "A", name: "Where waits are long (zone ranking)", metric: `Spearman ρ = ${N.validation.A.spearman.toFixed(2)}`, crit: `ρ ≥ ${N.criteria.A_spearman}`, ok: N.validation.A.pass },
    { id: "B", name: "Shape of the wait distribution", metric: `p90 / median = ${N.validation.B.sim.toFixed(2)} vs ${N.validation.B.real.toFixed(2)} real`, crit: `within ±${pct(N.criteria.B_rel, 0)}`, ok: N.validation.B.pass },
    { id: "C", name: "Travel times on the street network", metric: `median relative error ${pct(N.C.median_rel_error, 0)}`, crit: `≤ ${pct(N.criteria.C_median_rel, 0)}`, ok: N.C.pass },
    { id: "D", name: "Little's law on busy cars", metric: `${num(N.validation.D.sim_busy)} vs ${num(N.validation.D.real_busy)} real`, crit: `within ±${pct(N.criteria.D_rel, 0)}`, ok: N.validation.D.pass },
  ] : [];

  // ================================================================ OVERVIEW
  builders.overview = (root) => {
    const vPass = vChecks.filter((c) => c.ok).length, nPass = nycTests.filter((t) => t.ok).length;
    const gates = D.ab.flatMap((a) => a.gates);
    const cities = D.cities.length;
    root.append(h(`
      <section class="hero"><span class="eyebrow">Discrete-event simulation · real street networks</span>
        <h2>How many cars does a city <em>actually</em> need?</h2>
        <p class="lede">UrbanSim simulates a ride-hailing fleet minute by minute and searches for <b>N*</b>, the smallest fleet that meets a service target (for ride-hailing: 90% of riders wait at most <b>${SLA.p90_wait_min} min</b> and at most <b>${pct(SLA.abandon_rate, 0)}</b> give up). Every N* comes with a confidence interval, every comparison is a paired A/B test with controls, and the model is checked against queueing theory and against real trips.</p>
        <div class="actions"><a class="btn cta" href="#live" data-goto="live">Watch the simulation <span class="arrow">→</span></a><a class="btn" href="#realdata" data-goto="realdata">See the validation</a><a class="btn" href="https://github.com/Calazansmacchiutti/UrbanSims" target="_blank" rel="noopener">GitHub</a></div></section>
      <div class="grid cols-4">
        <div class="card accent kpi"><span class="label">Minimum fleet · base city</span><span class="value">${base ? base.n_star : "–"}<small>cars</small></span><span class="detail">${base && base.ci ? `95% CI ${base.ci[0]}–${base.ci[1]} · ${num(base.n_runs)} simulated runs` : ""}</span></div>
        <div class="card kpi"><span class="label">With smarter drivers</span><span class="value">${bestAgent ? bestAgent.n_star : "–"}<small>cars</small></span><span class="detail">${bestAgent && stayAgent ? `${esc(bestAgent.label)}: ${spct(bestAgent.n_star / stayAgent.n_star - 1, 0)} vs drivers who stay put` : ""}</span></div>
        <div class="card kpi"><span class="label">Theory checks</span><span class="value">${vPass}<small>of ${vChecks.length} pass</small></span><span class="detail">Erlang C, Little's law, search law, equilibrium</span></div>
        <div class="card kpi"><span class="label">Real-data validation · Manhattan</span><span class="value">${nPass}<small>of ${nycTests.length} tests</small></span><span class="detail">${badge(nPass === nycTests.length ? "pass" : "fail", nPass === nycTests.length ? "validated" : "not yet validated")}</span></div>
      </div>
      <div class="section-title">The pipeline</div>
      <div class="flow">
        <div class="step"><b>Scenario</b><span>A YAML file: street network, demand profile, patience, dispatch, driver behavior.</span></div>
        <div class="step"><b>Simulate</b><span>Discrete-event engine (SimPy). Every trip leg and decision goes to one event log.</span></div>
        <div class="step"><b>Measure</b><span>KPIs inside the peak window only: p90 wait, share who gave up, utilization.</span></div>
        <div class="step"><b>Size</b><span>Bisection on fleet size with common random numbers; bootstrap CI and adaptive replications.</span></div>
        <div class="step"><b>Compare</b><span>Paired A/B on N* with a registered minimum effect and shuffled / uniform controls.</span></div>
        <div class="step"><b>Validate</b><span>Closed-form queueing results, then real trips from New York's TLC.</span></div>
      </div>
      <div class="section-title">What each tab shows</div>
      <div class="grid cols-3" id="ov-cards"></div>
      <div class="section-title">Key findings so far</div>
      <div class="card"><ul id="ov-findings" style="margin:0;padding-left:1.1rem"></ul></div>`));
    const cards = [
      ["live", "Live simulation", `${D.replays.length} replays: watch two fleets side by side, with the same requests, and click any car for its driver card.`],
      ["sizing", "Fleet sizing", "Service level against fleet size, with confidence bands, the minimum fleet and the offline lower bound."],
      ["behavior", "Driver behavior", "How much fleet each driver behavior needs, and what a central platform adds."],
      ["experiments", "A/B experiments", `${gates.length} registered gates in ${D.ab.length} experiment designs, as forest plots with the 1% minimum effect.`],
      ["theory", "Theory checks", "The simulator reproduces Erlang C, Little's law, the square-root search law and a market equilibrium."],
      ["realdata", "Real-data validation", "Manhattan against 5.3 million TLC requests: what passed, what failed and why; is real demand Poisson?"],
      ["cities", "Cities", `${cities} versioned OpenStreetMap networks, from a Brazilian town to Manhattan.`],
      ["methods", "Methods & roadmap", "The statistics behind each number, the limits, and what comes next."],
    ];
    $("#ov-cards", root).append(h(cards.map(([id, t, d]) => `<a class="card" href="#${id}" data-goto="${id}"><span class="eyebrow">Open tab →</span><h3>${esc(t)}</h3><p class="sub" style="margin:0.3rem 0 0">${esc(d)}</p></a>`).join("")));
    const f = [];
    if (base && stayAgent && bestAgent) f.push(`On the base city, <b>${base.n_star}</b> cars meet the target when drivers stay where they drop off. Drivers who weigh demand against the free cars already there need <b>${bestAgent.n_star}</b> (${spct(bestAgent.n_star / stayAgent.n_star - 1, 0)}).`);
    const plat = baseAgents.find((r) => r.variant === "plataforma"), opp = baseAgents.find((r) => r.variant === "segue_oportunidade");
    if (plat && opp) f.push(`A central platform needs <b>${plat.n_star}</b> cars against <b>${opp.n_star}</b> for independent, well-informed drivers: the price of anarchy is close to 1. Information pays; coordination barely does.`);
    const q1 = D.ab.filter((a) => a.suite === "ab_plataforma").map((a) => a.gates.find((g) => g.id === "Q1")).filter(Boolean);
    if (q1.length) f.push(`The platform v2 beats the first platform in <b>${q1.filter((g) => g.result === "pass").length} of ${q1.length}</b> designs (paired A/B, 1% minimum effect).`);
    if (N) f.push(`Manhattan does <b>not</b> validate yet: with the fleet calibrated on one day, waits on another day come out ${num(N.validation.out_of_sample_mean_wait.sim, 1)} min against ${num(N.validation.out_of_sample_mean_wait.real, 1)} min real. The diagnosis (short trips too fast, an open city boundary, no acceptance delay) sets the next round.`);
    if (D.tlc) f.push(`Real demand is Poisson at the zone scale (variance-to-mean ratio ${D.tlc.rows[4].vmr}) but bursty city-wide (${D.tlc.rows[1].vmr}); a Cox process calibrated on it (CV ${pct(D.tlc.cox_fit.cv)}, memory ${D.tlc.cox_fit.tau_min} min) is now in the demand generator.`);
    $("#ov-findings", root).innerHTML = f.map((x) => `<li style="margin-bottom:0.55rem">${x}</li>`).join("");
  };

  // ================================================================ LIVE
  builders.live = (root) => {
    root.append(h(`${head("Live simulation", "Watch the fleet", "Each replay re-plays one simulated run from its event log. Both sides share the same seed: identical requests at identical times and places, so any difference on screen comes from the one thing that changed. Press <b>Space</b> to play or pause and <b>← →</b> to step one minute.")}
      <div class="controls" id="lv-controls"></div>
      <iframe class="frame" id="lv-frame" title="Fleet replay" loading="lazy" style="height:1400px"></iframe>
      <p class="foot" id="lv-open"></p>`));
    if (!D.replays.length) { $("#lv-controls", root).innerHTML = `<p class="empty">No replays were found in docs/resultados.</p>`; return; }
    const groups = [...new Set(D.replays.map((r) => r.scenario))];
    const firstOf = (g) => D.replays.find((r) => r.scenario === g);
    const pref = D.replays.find((r) => r.file.includes("base_ride_hailing_agentes__replay_parado")) || D.replays[0];
    $("#lv-controls", root).innerHTML = field("City / design", select("lv-scen", groups.map((g) => ({ value: g, label: scen(g).label })), pref.scenario)) + field("Replay", `<select id="lv-file"></select>`);
    const frame = $("#lv-frame", root);
    function fill(g, file) {
      const list = D.replays.filter((r) => r.scenario === g);
      $("#lv-file", root).innerHTML = list.map((r) => `<option value="${esc(r.file)}"${r.file === file ? " selected" : ""}>${esc(r.title.replace(/^[^·]*·\s*/, ""))} · ${esc(suite(r.suite).label)}</option>`).join("");
      load($("#lv-file", root).value);
    }
    function load(file) {
      const r = D.replays.find((x) => x.file === file);
      frame.src = `${file}?embed=1&theme=${theme()}`;
      $("#lv-open", root).innerHTML = `${esc(r.title)} · ${r.kb} KB · <a href="${esc(file)}" target="_blank" rel="noopener">open full screen ↗</a>`;
    }
    $("#lv-scen", root).addEventListener("change", (e) => fill(e.target.value, firstOf(e.target.value).file));
    $("#lv-file", root).addEventListener("change", (e) => load(e.target.value));
    window.addEventListener("message", (e) => { if (e.data && e.data.replayHeight && e.source === frame.contentWindow) frame.style.height = e.data.replayHeight + 8 + "px"; });
    fill(pref.scenario, pref.file);
  };

  // ================================================================ FLEET SIZING
  function curveCharts(host, entries, opts) {
    host.innerHTML = `<div class="grid cols-2">
      <div class="card"><div class="card-head"><div><h3>p90 wait vs fleet size</h3><p class="sub">Mean over replications · band = 95% CI · dashed red = target</p></div></div>${entries.length > 1 ? legend(entries.map((e, i) => ({ label: e.label, color: e.color || SERIES[i] }))) : ""}<div data-c="p90"></div></div>
      <div class="card"><div class="card-head"><div><h3>Share who gave up vs fleet size</h3><p class="sub">Riders who left before a car arrived (patience 10 min)</p></div></div>${entries.length > 1 ? legend(entries.map((e, i) => ({ label: e.label, color: e.color || SERIES[i] }))) : ""}<div data-c="ab"></div></div>
      ${opts && opts.util ? `<div class="card span-all"><div class="card-head"><div><h3>Utilization vs fleet size</h3><p class="sub">Share of car time with a passenger or driving to one</p></div></div><div data-c="util"></div></div>` : ""}
    </div>`;
    const ser = (key, hw) => entries.map((e, i) => ({ name: e.label, color: e.color || SERIES[i], points: e.curve.filter((p) => p[key] !== null).map((p) => ({ x: p.n, y: p[key], ...(hw && p[hw] !== null ? { lo: Math.max(0, p[key] - p[hw]), hi: p[key] + p[hw] } : {}) })) }));
    const vl = entries.length === 1 ? [{ x: entries[0].n_star, label: `N* = ${entries[0].n_star}` }] : [];
    UC.line($('[data-c="p90"]', host), { series: ser("p90", "p90_hw"), x: { label: "fleet size (cars)", name: "N" }, y: { fmt: (v) => v.toFixed(0) + " min", min: 0 }, hlines: [{ y: SLA.p90_wait_min, label: `target ${SLA.p90_wait_min} min` }], vlines: vl, aria: "p90 wait against fleet size" });
    UC.line($('[data-c="ab"]', host), { series: ser("ab", "ab_hw"), x: { label: "fleet size (cars)", name: "N" }, y: { fmt: (v) => pct(v, 0), min: 0 }, hlines: [{ y: SLA.abandon_rate, label: `target ${pct(SLA.abandon_rate, 0)}` }], vlines: vl, aria: "Share who gave up against fleet size" });
    if (opts && opts.util) UC.line($('[data-c="util"]', host), { height: 220, series: ser("util"), x: { label: "fleet size (cars)", name: "N" }, y: { fmt: (v) => pct(v, 0), min: 0 }, vlines: vl, aria: "Utilization against fleet size" });
  }

  builders.sizing = (root) => {
    root.append(h(`${head("Fleet sizing", "The minimum fleet N*", `N* is the smallest fleet whose <b>upper</b> confidence bound still meets every target inside the peak window. It is found by bisection on N: each candidate N runs 10 to 200 replications until the CI is tight, all candidates reuse the same random seeds (common random numbers), and the CI on N* comes from 2,000 bootstrap resamples of the replications.`)}
      <div class="controls" id="sz-controls"></div>
      <div class="grid cols-4" id="sz-kpis"></div>
      <div id="sz-charts" style="margin-top:16px"></div>
      <div class="section-title">Every N* in the repository</div>
      <div class="card"><div class="table-wrap" id="sz-table"></div></div>`));
    const keys = [...new Map(D.sizing.map((r) => [`${r.scenario}|${r.suite}`, r])).values()];
    const opts = keys.map((r) => ({ value: `${r.scenario}|${r.suite}`, label: `${scen(r.scenario).label} · ${suite(r.suite).label}` }));
    const c = $("#sz-controls", root);
    c.innerHTML = field("Scenario & study", select("sz-pick", opts, "base|")) + field("Variant", `<select id="sz-var"></select>`);
    function draw() {
      const [s, su] = $("#sz-pick", root).value.split("|");
      const list = D.sizing.filter((r) => r.scenario === s && r.suite === su);
      const vSel = $("#sz-var", root);
      if (!vSel.dataset.for || vSel.dataset.for !== s + su) {
        vSel.innerHTML = list.map((r) => `<option value="${esc(r.variant)}">${esc(r.label)}</option>`).join("");
        vSel.dataset.for = s + su;
      }
      const r = list.find((x) => x.variant === vSel.value) || list[0];
      $("#sz-kpis", root).innerHTML = `
        <div class="card accent kpi"><span class="label">N* · ${esc(r.label)}</span><span class="value">${r.n_star}<small>cars</small></span><span class="detail">95% CI ${r.ci ? `${r.ci[0]}–${r.ci[1]}` : "n/a"}</span></div>
        <div class="card kpi"><span class="label">Replications</span><span class="value">${r.replicas ?? "–"}</span><span class="detail">${r.converged ? badge("pass", "CI converged") : badge("warn", "hit the replication cap")}</span></div>
        <div class="card kpi"><span class="label">Offline lower bound</span><span class="value">${r.floor ?? "–"}<small>${r.floor ? "cars" : ""}</small></span><span class="detail">${r.floor ? "Fleet a planner who knew every trip in advance would need (bipartite matching)" : "Computed only in single-variant sizing runs"}</span></div>
        <div class="card kpi"><span class="label">Offered load</span><span class="value">${r.load ? num(r.load, 1) : "–"}<small>busy cars</small></span><span class="detail">Arrival rate × mean service time (Little's law): fewer cars than this can never keep up</span></div>`;
      curveCharts($("#sz-charts", root), [{ ...r, label: r.label }], { util: true });
    }
    $("#sz-pick", root).addEventListener("change", draw);
    $("#sz-var", root).addEventListener("change", draw);
    draw();
    const rows = D.sizing.slice().sort((a, b) => (a.scenario + a.suite).localeCompare(b.scenario + b.suite) || a.n_star - b.n_star);
    $("#sz-table", root).innerHTML = `<table class="data"><thead><tr><th>Scenario</th><th>Study</th><th>Variant</th><th class="num">N*</th><th class="num">95% CI</th><th class="num">Replications</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(scen(r.scenario).label)}</td><td>${esc(suite(r.suite).label)}</td><td>${esc(r.label)}</td><td class="num"><b>${r.n_star}</b></td><td class="num">${r.ci ? `${r.ci[0]}–${r.ci[1]}` : "–"}</td><td class="num">${r.replicas ?? "–"}</td></tr>`).join("")}</tbody></table>`;
  };

  // ================================================================ DRIVER BEHAVIOR
  builders.behavior = (root) => {
    const scens = [...new Set(D.sizing.filter((r) => r.suite === "agentes").map((r) => r.scenario))];
    root.append(h(`${head("Driver behavior", "Who decides where idle cars go?", "Drivers are agents that choose where to wait. A zone mediator tells them the recent requests per zone and, depending on the behavior, how many free cars are already there. Same demand, same seeds; only the behavior changes.")}
      <div class="grid cols-4" id="bh-notes"></div>
      <div class="controls" style="margin-top:20px" id="bh-controls"></div>
      <div class="grid cols-2">
        <div class="card"><div class="card-head"><div><h3>N* by behavior</h3><p class="sub">Bars = N* · whiskers = 95% CI</p></div><div id="bh-poa"></div></div><div id="bh-bars"></div></div>
        <div class="card"><div class="card-head"><div><h3>p90 wait by behavior</h3><p class="sub">Same seeds on every curve</p></div></div><div id="bh-leg"></div><div id="bh-lines"></div></div>
      </div>
      <div class="section-title">Platform variants (base city)</div>
      <div class="card"><div class="card-head"><div><h3>Ladder of platform components</h3><p class="sub">Each rung adds one component: a demand forecast, counting cars about to drop off nearby (B), targets set by expected wait (C) and a 15-minute travel cap (D). Platform v2 = all of them. <span style="color:var(--s4)">■</span> platform · <span style="color:var(--s3)">■</span> independent drivers</p></div></div><div id="bh-ladder"></div></div>`));
    $("#bh-notes", root).innerHTML = BEH_ORDER.map((k) => `<div class="card"><span class="eyebrow" style="color:var(--ink)"><span style="color:var(${BEH_COLOR[k]})">●</span> ${esc(D.behaviors[k].label)}</span><p style="margin:0">${esc(D.behaviors[k].note)}</p></div>`).join("");
    $("#bh-controls", root).innerHTML = `<div class="seg" role="group" aria-label="City">${scens.map((s, i) => `<button data-s="${esc(s)}" aria-pressed="${i === 0}">${esc(scen(s).label)}</button>`).join("")}</div>`;
    function draw(s) {
      const list = BEH_ORDER.map((k) => agentsOf(s).find((r) => r.variant === k)).filter(Boolean);
      $("#bh-bars", root).innerHTML = ""; $("#bh-lines", root).innerHTML = "";
      UC.bars($("#bh-bars", root), { rows: list.map((r) => ({ label: r.label, value: r.n_star, lo: r.ci && r.ci[0], hi: r.ci && r.ci[1], color: BEH_COLOR[r.variant] })), xLabel: "minimum fleet N* (cars)", aria: "N* by driver behavior" });
      $("#bh-leg", root).innerHTML = legend(list.map((r) => ({ label: r.label, color: BEH_COLOR[r.variant] })));
      UC.line($("#bh-lines", root), { series: list.map((r) => ({ name: r.label, color: BEH_COLOR[r.variant], points: r.curve.filter((p) => p.p90 !== null).map((p) => ({ x: p.n, y: p.p90 })) })), x: { label: "fleet size (cars)", name: "N" }, y: { fmt: (v) => v.toFixed(0) + " min", min: 0 }, hlines: [{ y: SLA.p90_wait_min, label: `target ${SLA.p90_wait_min} min` }], aria: "p90 wait by behavior" });
      const plat = list.find((r) => r.variant === "plataforma"), dec = list.filter((r) => r.variant !== "plataforma").sort((a, b) => a.n_star - b.n_star)[0];
      $("#bh-poa", root).innerHTML = plat && dec ? `<div class="kpi" style="text-align:right"><span class="label">Price of anarchy</span><span class="value" style="font-size:1.6rem">${(dec.n_star / plat.n_star).toFixed(2)}</span><span class="detail">best independent ÷ platform</span></div>` : "";
    }
    $("#bh-controls", root).addEventListener("click", (e) => { const b = e.target.closest("button[data-s]"); if (!b) return; for (const x of $("#bh-controls", root).querySelectorAll("button")) x.setAttribute("aria-pressed", x === b); draw(b.dataset.s); });
    if (scens.length) draw(scens[0]);
    const lad = D.sizing.filter((r) => r.scenario === "base" && r.suite === "variantes_plataforma").sort((a, b) => b.n_star - a.n_star);
    if (lad.length) UC.bars($("#bh-ladder", root), { rows: lad.map((r) => ({ label: r.label, value: r.n_star, lo: r.ci && r.ci[0], hi: r.ci && r.ci[1], color: r.variant.startsWith("plataforma") ? "--s4" : "--s3" })), labelW: 330, xLabel: "minimum fleet N* (cars)", aria: "Platform variants" });
    else $("#bh-ladder", root).innerHTML = `<p class="empty">No platform-variant results.</p>`;
  };

  // ================================================================ A/B EXPERIMENTS
  builders.experiments = (root) => {
    const suites = [...new Set(D.ab.map((a) => a.suite))];
    root.append(h(`${head("A/B experiments", "Paired tests on the minimum fleet", `Each gate compares two variants, A and B, on the <b>same 40 seed grids</b>. The statistic is the relative difference in N*, (N*<sub>B</sub> − N*<sub>A</sub>) / N*<sub>A</sub>, with a 95% paired bootstrap CI. The criterion was registered before running: a gate <b>passes</b> only if the whole CI is beyond the <b>1% minimum effect</b> (grey band) in the expected direction. Gates marked “… and” are controls: the forecast must also beat a <i>uniform</i> map (no pattern) and a <i>shuffled</i> map (the pattern in the wrong place), or its gain is vetoed.`)}
      <div class="controls" id="ab-controls"></div>
      <div class="card"><div class="card-head"><div><h3 id="ab-title"></h3><p class="sub" id="ab-sub"></p></div><div>${legend([{ label: "pass", color: "--good", box: true }, { label: "fail", color: "--bad", box: true }, { label: "±1% minimum effect", color: "--neutral", box: true }])}</div></div><div id="ab-forest"></div></div>
      <div class="section-title">All designs at a glance</div>
      <div class="card"><div class="table-wrap" id="ab-matrix"></div><p class="foot">Each cell: the gate's result in that design, with the point estimate of the relative difference in N*.</p></div>`));
    const designsOf = (su) => D.ab.filter((a) => a.suite === su).map((a) => a.scenario);
    $("#ab-controls", root).innerHTML = field("Experiment", select("ab-suite", suites.map((s) => ({ value: s, label: suite(s).label })), suites[0])) + field("Design", `<select id="ab-design"></select>`);
    function fillDesigns() {
      const su = $("#ab-suite", root).value;
      $("#ab-design", root).innerHTML = designsOf(su).map((s) => `<option value="${esc(s)}"${s === "base" ? " selected" : ""}>${esc(scen(s).label)}</option>`).join("");
    }
    function draw() {
      const su = $("#ab-suite", root).value, s = $("#ab-design", root).value;
      const a = D.ab.find((x) => x.suite === su && x.scenario === s);
      $("#ab-title", root).textContent = `${suite(su).label} · ${scen(s).label}`;
      $("#ab-sub", root).textContent = `${scen(s).desc} ${a.gates[0] ? a.gates[0].seeds + " paired seeds per gate." : ""}`;
      const host = $("#ab-forest", root); host.innerHTML = "";
      UC.forest(host, {
        rows: a.gates.map((g) => ({
          label: `${g.id} · ${g.question}`, sub: `B: ${g.b_label}   vs   A: ${g.a_label}`, est: g.rel[0], lo: g.rel[1], hi: g.rel[2], status: g.result === "pass" ? "pass" : "fail",
          tip: `<div class="t-head">${esc(g.id)} · ${esc(g.question)}</div><div class="t-row"><span>A</span><b>${esc(g.a_label)} · N* ${g.n_a}</b></div><div class="t-row"><span>B</span><b>${esc(g.b_label)} · N* ${g.n_b}</b></div><div class="t-row"><span>ΔN*/N*</span><b>${spct(g.rel[0])} [${spct(g.rel[1])}, ${spct(g.rel[2])}]</b></div><div class="t-row"><span>ΔN* (cars)</span><b>${g.abs[0]} [${g.abs[1]}, ${g.abs[2]}]</b></div><div class="t-row"><span>expects</span><b>${esc(g.direction_label)}</b></div><div class="t-row"><span>result</span><b>${esc(g.result)}</b></div>`,
        })),
        band: [-0.01, 0.01], fmt: (v) => spct(v, 0), xLabel: "relative difference in N*, B vs A", leftNote: "← B needs fewer cars", rightNote: "B needs more cars →", rowH: 44, labelW: 400, aria: "Forest plot of the A/B gates",
      });
      // matrix
      const des = designsOf(su), ids = a.gates.map((g) => g.id);
      $("#ab-matrix", root).innerHTML = `<table class="data"><thead><tr><th>Gate</th>${des.map((d) => `<th>${esc(scen(d).label)}</th>`).join("")}</tr></thead><tbody>${ids.map((id) => {
        const g0 = a.gates.find((g) => g.id === id);
        return `<tr><td><b>${esc(id)}</b> <span class="muted">${esc(g0.question)}</span></td>${des.map((d) => { const g = D.ab.find((x) => x.suite === su && x.scenario === d).gates.find((x) => x.id === id); return `<td>${g ? `${badge(g.result === "pass" ? "pass" : "fail", g.result)} <span class="muted mono">${spct(g.rel[0])}</span>` : "–"}</td>`; }).join("")}</tr>`;
      }).join("")}</tbody></table>`;
    }
    $("#ab-suite", root).addEventListener("change", () => { fillDesigns(); draw(); });
    $("#ab-design", root).addEventListener("change", draw);
    fillDesigns(); draw();
  };

  // ================================================================ THEORY CHECKS
  builders.theory = (root) => {
    if (!V) { root.innerHTML = head("Theory checks", "Theory checks", "") + `<p class="empty">Run <code>urbansim verify --json docs/resultados/verificacao/resultado.json</code> to add them.</p>`; return; }
    root.append(h(`${head("Theory checks", "Does the simulator reproduce known results?", "Before trusting N*, the engine must agree with results that have a closed form. Each check runs the real engine on a setting where the answer is known, with a tolerance fixed in advance.")}
      <div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>Check</th><th>What is compared</th><th>Result</th></tr></thead><tbody id="th-table"></tbody></table></div></div>
      <div class="grid cols-2" style="margin-top:16px">
        <div class="card"><div class="card-head"><div><h3>V1 · Erlang C queue</h3><p class="sub">M/M/10 queue, 10-minute mean service, no abandonment. Mean wait: formula vs simulation (95% CI over ${V.V1[0].n} replications)</p></div>${passBadge(V.V1.every((r) => r.pass))}</div>${legend([{ label: "Erlang C formula", color: "--s2", dash: true }, { label: "simulation ± 95% CI", color: "--s1" }])}<div id="th-v1"></div></div>
        <div class="card"><div class="card-head"><div><h3>V2 · Search law</h3><p class="sub">Pickup distance falls as (free cars)<sup>−1/2</sup>. Log-log slope fitted on ${num(V.V2.n_points)} assignments; accepted ${V.V2_range || V.tolerances.V2_slope_range.join(" to ")}</p></div>${passBadge(V.V2.pass)}</div><div id="th-v2"></div></div>
        <div class="card"><div class="card-head"><div><h3>V3 · Little's law</h3><p class="sub">Requests pending on average (L) against arrival rate × mean time pending (λW), ${esc(scen(V.V3.scenario).label)} scenario</p></div>${passBadge(V.V3.pass)}</div>
          <div class="mini3"><div class="kpi"><span class="label">L</span><span class="value">${V.V3.L.toFixed(3)}</span></div><div class="kpi"><span class="label">λ · W</span><span class="value">${(V.V3.lam * V.V3.W).toFixed(3)}</span><span class="detail">λ = ${V.V3.lam.toFixed(3)}/min · W = ${V.V3.W.toFixed(2)} min</span></div><div class="kpi"><span class="label">Relative error</span><span class="value">${pct(V.V3.rel_error, 2)}</span><span class="detail">tolerance ${pct(V.tolerances.V3_rel_error, 0)}</span></div></div></div>
        <div class="card"><div class="card-head"><div><h3>V6 · Equilibrium between two zones</h3><p class="sub">Demand 3 : 1 between a hot and a cold zone. Drivers who see supply should settle at 3 : 1 free cars (±${pct(V.V6b.rel_tol, 0)})</p></div>${passBadge(V.V6a.pass && V.V6b.pass)}</div><div id="th-v6"></div>
          <p class="foot">Static market (V6a): seeing supply, ${V.V6a.supply_aware[0]} : ${V.V6a.supply_aware[1]} drivers (expected ${V.V6a.expected[0]} : ${V.V6a.expected[1]}); seeing only demand, ${V.V6a.demand_only[0]} : ${V.V6a.demand_only[1]}: everyone herds to the hot zone.</p></div>
      </div>`));
    const rows = [
      ["V1", "Erlang C", `Mean wait in an M/M/10 queue at load ρ = ${V.V1.map((r) => r.rho).join(", ")}`, V.V1.every((r) => r.pass)],
      ["V2", "Search law", `Slope ${V.V2.slope.toFixed(3)} (theory −0.5)`, V.V2.pass],
      ["V3", "Little's law", `L = λW within ${pct(V.V3.rel_error, 2)}`, V.V3.pass],
      ["V4", "Offline lower bound", "N* is never below the fleet of a planner who knows all trips (checked in every sizing run)", true],
      ["V5", "Common random numbers", "Changing only the fleet leaves the request stream identical", V.V5.pass],
      ["V6", "Wardrop-style equilibrium", "Free cars split in proportion to demand when drivers see supply", V.V6a.pass && V.V6b.pass],
    ];
    $("#th-table", root).innerHTML = rows.map(([id, n, w, ok]) => `<tr><td><b>${id}</b> · ${esc(n)}</td><td>${esc(w)}</td><td>${passBadge(ok)}</td></tr>`).join("");
    UC.line($("#th-v1", root), { height: 250, series: [
      { name: "Erlang C formula", color: "--s2", dash: true, points: V.V1.map((r) => ({ x: r.rho, y: r.theory })) },
      { name: "simulation", color: "--s1", points: V.V1.map((r) => ({ x: r.rho, y: r.sim, lo: Math.max(0, r.sim - r.hw), hi: r.sim + r.hw })) },
    ], x: { label: "load ρ (arrival rate ÷ capacity)", name: "ρ", fmt: (v) => v.toFixed(1) }, y: { fmt: (v) => v.toFixed(1) + " min", min: 0 }, aria: "Erlang C check" });
    const b = V.V2.bins, lx = b.map((p) => Math.log(p[0])), ly = b.map((p) => Math.log(p[1]));
    const mx = lx.reduce((a, c) => a + c, 0) / lx.length, my = ly.reduce((a, c) => a + c, 0) / ly.length;
    UC.scatter($("#th-v2", root), { height: 260, points: b.map((p) => ({ x: p[0], y: p[1], r: 4 + Math.min(5, Math.sqrt(p[2]) / 6), tip: `<div class="t-head">${num(p[0], 1)} free cars</div><div class="t-row"><span>mean pickup</span><b>${p[1].toFixed(2)} km</b></div><div class="t-row"><span>assignments</span><b>${p[2]}</b></div>` })),
      x: { label: "free cars when the request arrives (log)", log: true }, y: { label: "pickup km (log)", log: true, fmt: (v) => v + " km" },
      fit: { slope: V.V2.slope, intercept: my - V.V2.slope * mx, label: `fitted slope ${V.V2.slope.toFixed(2)}` }, ref: { slope: -0.5, intercept: my + 0.5 * mx, label: "theory −0.5" }, aria: "Search law check" });
    const levels = V.V6b.rates_per_h.map((r) => `${r[0]}+${r[1]} req/h`);
    const behs = Object.keys(V.V6b.ratio);
    UC.bars($("#th-v6", root), { rows: behs.flatMap((k) => V.V6b.ratio[k].map((v, i) => ({ label: `${D.behaviors[k] ? D.behaviors[k].label : k} · ${levels[i]}`, value: v, color: BEH_COLOR[k] }))), fmt: (v) => v.toFixed(2), refs: [{ x: V.V6b.target, label: `target ${V.V6b.target} : 1` }], labelW: 250, xLabel: "free cars, hot zone ÷ cold zone", aria: "Equilibrium check" });
  };

  // ================================================================ REAL DATA
  builders.realdata = (root) => {
    root.append(h(`${head("Real-data validation", "Manhattan against NYC trip records", "The strictest test available: calibrate <b>one number</b> (the fleet) on one weekday, then predict another weekday's waits zone by zone, against Uber and Lyft trip records from the NYC Taxi & Limousine Commission. Criteria were approved before running. The model <b>did not pass</b>; the failure is reported in full because it says exactly what to build next.")}
      <div class="grid cols-4" id="rd-kpis"></div>
      <div class="card" style="margin-top:16px"><div class="table-wrap"><table class="data"><thead><tr><th>Test</th><th>Measured</th><th>Criterion</th><th>Result</th></tr></thead><tbody id="rd-tests"></tbody></table></div></div>
      <div class="grid cols-2" style="margin-top:16px">
        <div class="card"><div class="card-head"><div><h3>Mean wait by pickup zone</h3><p class="sub">Out-of-sample day · each dot is a TLC zone · dashed = perfect agreement (log scales)</p></div>${passBadge(N && N.validation.A.pass)}</div><div id="rd-zones"></div></div>
        <div class="card"><div class="card-head"><div><h3>Calibration: fleet vs mean wait</h3><p class="sub">Bisection steps on the calibration day · dashed = real mean wait. Below ~4,500 cars the city saturates and waits explode</p></div></div><div id="rd-cal"></div></div>
        <div class="card"><div class="card-head"><div><h3>Wait distribution</h3><p class="sub">Median and p90 of the wait, simulation vs real</p></div>${passBadge(N && N.validation.B.pass)}</div><div id="rd-q"></div></div>
        <div class="card"><div class="card-head"><div><h3>Why it failed: diagnosis</h3><p class="sub">From the residuals of the travel-time fit and the trip flows</p></div></div>
          <p class="callout bad"><b>Short trips are too fast, long trips too slow.</b> One speed factor (${N ? N.speed.speed_factor.toFixed(3) : "–"} × OSM free flow, fitted on ${N ? num(N.speed.trips) : "–"} trips) cannot fit both: travel time needs an intercept (time to start, park, find the rider).</p>
          <p class="callout bad"><b>The city is open.</b> Thousands of cars enter and leave Manhattan every hour; a closed simulation has to buy that supply with a fleet calibrated at the edge of saturation (${N ? num(N.calibration.n) : "–"} cars).</p>
          <p class="callout bad"><b>No matching or acceptance delay.</b> Real waits include the time until a driver accepts; the simulator dispatches instantly.</p>
          <p class="callout good"><b>Next round</b> (needs new registered criteria): affine travel time, an acceptance delay, cars entering and leaving at the boundary, calibration in the slack regime.</p></div>
      </div>
      <div class="section-title">Is real demand Poisson?</div>
      <div class="grid cols-2">
        <div class="card"><div class="card-head"><div><h3>Index of dispersion of request counts</h3><p class="sub" id="rd-tlc-sub"></p></div></div><div id="rd-vmr"></div><p class="foot">A Poisson process gives 1 at every scale (hover a bar for the 95% range it would produce by chance). <span id="rd-vmr-note"></span></p></div>
        <div class="card"><div class="card-head"><div><h3>What the generator does with it</h3><p class="sub">Log-Gaussian Cox process, calibrated on these numbers</p></div>${badge("info", "implemented")}</div><div id="rd-cox"></div></div>
      </div>`));
    if (!N) { $("#rd-kpis", root).innerHTML = `<p class="empty">No Manhattan validation results.</p>`; return; }
    const oos = N.validation.out_of_sample_mean_wait;
    $("#rd-kpis", root).innerHTML = `
      <div class="card kpi"><span class="label">Tests passed</span><span class="value">${nycTests.filter((t) => t.ok).length}<small>of ${nycTests.length}</small></span><span class="detail">${badge("fail", "not validated")}</span></div>
      <div class="card kpi"><span class="label">Calibrated fleet</span><span class="value">${num(N.calibration.n)}<small>cars</small></span><span class="detail">matches the real mean wait of ${N.calibration.target_mean_wait.toFixed(1)} min on the calibration day</span></div>
      <div class="card kpi"><span class="label">Out-of-sample mean wait</span><span class="value">${num(oos.sim, 1)}<small>min simulated</small></span><span class="detail">against ${num(oos.real, 1)} min real</span></div>
      <div class="card kpi"><span class="label">Unserved in simulation</span><span class="value">${pct(N.validation.unserved_share, 0)}</span><span class="detail">of requests on the validation day</span></div>`;
    $("#rd-tests", root).innerHTML = nycTests.map((t) => `<tr><td><b>${t.id}</b> · ${esc(t.name)}</td><td>${esc(t.metric)}</td><td>${esc(t.crit)}</td><td>${passBadge(t.ok)}</td></tr>`).join("") +
      `<tr><td><b>A₀</b> · Control: shuffled origins must not rank zones</td><td>Spearman ρ = ${N.validation.control.spearman.toFixed(2)}</td><td>ρ ≤ ${N.criteria.control_A_max}</td><td>${passBadge(N.validation.control.pass)}</td></tr>`;
    const zt = N.validation.zone_table;
    UC.scatter($("#rd-zones", root), { height: 300, points: zt.map((z) => ({ x: z.real, y: z.sim, color: "--s1", tip: `<div class="t-head">TLC zone ${z.PULocationID}</div><div class="t-row"><span>real</span><b>${z.real.toFixed(1)} min</b></div><div class="t-row"><span>simulated</span><b>${z.sim.toFixed(1)} min</b></div>` })), x: { label: "real mean wait (min)", log: true }, y: { label: "simulated mean wait (min)", log: true }, diag: true, aria: "Zone waits, real against simulated" });
    const hist = N.calibration.history.slice().sort((a, b) => a[0] - b[0]);
    UC.line($("#rd-cal", root), { height: 300, series: [{ name: "simulated mean wait", color: "--s1", points: hist.map((p) => ({ x: p[0], y: p[1] })) }], x: { label: "fleet size (cars)", name: "fleet", fmt: (v) => num(v) }, y: { fmt: (v) => v.toFixed(0) + " min", min: 0 }, hlines: [{ y: N.calibration.target_mean_wait, label: `real ${N.calibration.target_mean_wait.toFixed(1)} min`, color: "--accent" }], vlines: [{ x: N.calibration.n, label: `${num(N.calibration.n)}` }], aria: "Calibration bisection" });
    const sq = N.validation.sim_quantiles, rq = N.validation.real_quantiles;
    UC.bars($("#rd-q", root), { rows: [{ label: "median · real", value: rq["0.5"], color: "--s3" }, { label: "median · simulated", value: sq["0.5"], color: "--s1" }, { label: "p90 · real", value: rq["0.9"], color: "--s3" }, { label: "p90 · simulated", value: sq["0.9"], color: "--s1" }], fmt: (v) => v.toFixed(1) + " min", xLabel: "wait (min)", aria: "Wait quantiles" });
    const T = D.tlc;
    if (T) {
      $("#rd-tlc-sub", root).textContent = `${num(T.requests)} requests · ${T.source}`;
      const big = T.rows.filter((r) => r.vmr > 10);
      $("#rd-vmr-note", root).innerHTML = big.map((r) => `<b>${esc(r.scale)}: ${r.vmr}</b>, off this scale on purpose: that is the rate changing between night and peak, which the time-varying rate already models. `).join("");
      UC.bars($("#rd-vmr", root), { rows: T.rows.filter((r) => r.vmr <= 10).map((r) => ({ label: r.scale, value: r.vmr, color: r.vmr > (r.poisson_band ? r.poisson_band[1] : 1.5) ? "--s2" : "--s3", tip: `<div class="t-head">${esc(r.scale)}</div><div class="t-row"><span>VMR</span><b>${r.vmr}</b></div>${r.poisson_band ? `<div class="t-row"><span>Poisson 95%</span><b>${r.poisson_band[0]}–${r.poisson_band[1]}</b></div>` : ""}<div style="margin-top:4px">${esc(r.reading)}</div>` })), fmt: (v) => v.toFixed(2), labelW: 280, refs: [{ x: 1, label: "Poisson = 1", color: "--neutral" }], xLabel: "variance ÷ mean of counts per window", aria: "Index of dispersion" });
      const c = T.cox_fit;
      $("#rd-cox", root).innerHTML = `<p>The rate gets a random multiplier with mean 1, shared by the whole city (rain, a concert letting out): <code>λ(t) · M(t)</code>, with <code>log M</code> an AR(1) Gaussian process. The mean number of requests is unchanged; only the variance grows.</p>
        <div class="mini3"><div class="kpi"><span class="label">Rate CV</span><span class="value">${pct(c.cv, 1)}</span></div><div class="kpi"><span class="label">Memory τ</span><span class="value">${c.tau_min}<small>min</small></span></div><div class="kpi"><span class="label">Reproduces</span><span class="value" style="font-size:1.5rem">${c.vmr_1} · ${c.vmr_5}</span><span class="detail">VMR at 1 and 5 min</span></div></div>
        <p class="foot">Enable in a scenario with <code>demand: {cox: {cv: ${c.cv}, tau_min: ${c.tau_min}}}</code>. Off by default, so every earlier result is unchanged.</p>`;
    }
  };

  // ================================================================ CITIES
  builders.cities = (root) => {
    root.append(h(`${head("Cities", "Versioned real street networks", "A city is fetched once from OpenStreetMap by municipality name, reduced to its largest strongly connected component, consolidated at 15 m and saved under a content hash. A scenario names the exact version, so a result can always be re-run on the same streets.")}
      <div class="grid cols-3" id="ct-cards"></div>`));
    const host = $("#ct-cards", root);
    for (const c of D.cities) {
      const ag = c.scenario ? agentsOf(c.scenario) : [];
      const reps = D.replays.filter((r) => r.scenario === c.scenario);
      const card = h(`<div class="card"><span class="eyebrow">${esc(c.slug)} · v${esc(c.version)}</span><h3>${esc(c.query || c.name)}</h3><div data-map style="margin:0.8rem 0"></div>
        <div class="mini3"><div class="kpi"><span class="label">Intersections</span><span class="value" style="font-size:1.5rem">${num(c.nodes)}</span></div><div class="kpi"><span class="label">Streets</span><span class="value" style="font-size:1.5rem">${num(c.km)}<small>km</small></span></div><div class="kpi"><span class="label">Median speed</span><span class="value" style="font-size:1.5rem">${num(c.speed_median)}<small>km/h</small></span></div></div>
        ${ag.length ? `<div class="table-wrap" style="margin-top:0.8rem"><table class="data"><thead><tr><th>Behavior</th><th class="num">N*</th><th class="num">95% CI</th></tr></thead><tbody>${BEH_ORDER.map((k) => ag.find((r) => r.variant === k)).filter(Boolean).map((r) => `<tr><td>${esc(r.label)}</td><td class="num"><b>${r.n_star}</b></td><td class="num">${r.ci ? r.ci.join("–") : "–"}</td></tr>`).join("")}</tbody></table></div>` : `<p class="foot">${c.slug === "nyc-manhattan" ? `Used for the real-data validation. <a href="#realdata" data-goto="realdata">See the results →</a>` : "No sizing results on this network yet."}</p>`}
        ${reps.length ? `<p class="foot"><a href="#live" data-goto="live" data-replay="${esc(reps[0].file)}">Watch a replay on these streets →</a></p>` : ""}</div>`);
      host.append(card);
      UC.streets(host.lastElementChild.querySelector("[data-map]"), { segments: c.segments, extent: c.extent, aria: `Street network of ${c.query || c.name}` });
    }
    host.addEventListener("click", (e) => {
      const a = e.target.closest("[data-replay]"); if (!a) return;
      setTimeout(() => { const s = $("#lv-scen"), f = $("#lv-file"); const r = D.replays.find((x) => x.file === a.dataset.replay); if (s && r) { s.value = r.scenario; s.dispatchEvent(new Event("change")); f.value = r.file; f.dispatchEvent(new Event("change")); } }, 0);
    });
  };

  // ================================================================ METHODS
  builders.methods = (root) => {
    const m = [
      ["Demand", "Non-homogeneous Poisson process", "Requests arrive with an hourly rate profile, generated exactly by thinning. Optional log-Gaussian Cox multiplier for city-wide bursts.", "Real demand is bursty city-wide; the Cox option covers it."],
      ["Uncertainty", "Monte Carlo replications + Student-t CI", "Each fleet size runs independent replications until the CI half-width is small enough (10 to 200 runs).", "A replay is one replication; never conclude from one."],
      ["Variance reduction", "Common random numbers", "All fleet sizes and variants reuse the same seeds, so differences come from the change, not from luck.", "Breaks if a change consumes random numbers differently; tested (V5)."],
      ["Search", "Bisection on fleet size", "Service improves monotonically with N, so N* is found in a few steps, starting from an analytic bracket.", "The bracket is widened automatically when it misses."],
      ["Interval on N*", "Bootstrap, 2,000 resamples", "Replications are resampled and the bisection is repeated on each resample.", "Precision of ±1 car would need far more runs; we accept ±3."],
      ["Comparison", "Paired bootstrap of ΔN*/N*", "Both variants on the same seed grids; the CI of the relative difference decides, with a 1% minimum effect.", "Registered before running; vetoed by uniform and shuffled controls."],
      ["Gold standard", "Queueing theory", "Erlang C, Little's law and the square-root search law give answers the engine must reproduce.", "Valid only in the simple settings where they hold."],
      ["Lower bound", "Minimum path cover", "With every trip known in advance, the minimum fleet is a maximum bipartite matching.", "An offline ideal: no real dispatcher reaches it."],
      ["Drivers", "Logit choice among zones", "Drivers pick a zone with probability ∝ exp(value / temperature), value = demand per free car.", "Temperature 2 min, not yet fitted to data."],
      ["Platform", "Transport problem + Hungarian dispatch", "Free cars are moved to targets by a min-cost flow; requests matched in batches by the Hungarian algorithm.", "Polynomial and exact: no heuristic needed."],
      ["Forecasts", "Memory, history, model, EWMA", "Zone demand seen by drivers: last 15 min, historical profile, fitted model or exponentially weighted recency.", "History hurts when the center moves; recency fixes it."],
      ["Validation", "Spearman, quantile ratio, Little", "Zone ranking, distribution shape and busy-car balance against TLC trip records, with a shuffled control.", "Failed in Manhattan: see the diagnosis."],
    ];
    root.append(h(`${head("Methods & roadmap", "The statistics behind each number", "Each card names the method, what it does here and its main limitation.")}
      <div class="grid cols-3">${m.map(([e, t, d, l]) => `<div class="card"><span class="eyebrow">${esc(e)}</span><h3>${esc(t)}</h3><p style="margin:0.4rem 0 0.6rem">${esc(d)}</p><p class="foot" style="margin:0"><b>Limit.</b> ${esc(l)}</p></div>`).join("")}</div>
      <div class="section-title">Roadmap</div>
      <div class="grid cols-3">
        <div class="card"><span class="eyebrow">In progress</span><h3>Manhattan, round two: learn the city&#39;s friction</h3><p class="sub">Learn what traffic signals, stops, curb space and the city boundary cost, from OpenStreetMap features and NYC trips; then simulate Chicago from its map alone and compare with its official trip data, sealed until the end.</p></div>
        <div class="card"><span class="eyebrow">Next</span><h3>Westminster speeds</h3><p class="sub">Calibrate London speeds with DfT CGN05 data by local authority; transfer service parameters from Manhattan.</p></div>
        <div class="card"><span class="eyebrow">Next</span><h3>N* under bursty demand</h3><p class="sub">Paired A/B of the base city with and without the calibrated Cox process.</p></div>
        <div class="card"><span class="eyebrow">Planned</span><h3>Learning and multi-agent research</h3><p class="sub">Trained demand forecasts, reinforcement-learning repositioning, drivers who interact.</p></div>
        <div class="card"><span class="eyebrow">Planned</span><h3>Costs and mixed fleets</h3><p class="sub">Cost layer, shifts, electric vehicles and charging as scenario axes.</p></div>
        <div class="card flat" style="border-style:dashed"><span class="eyebrow" style="color:var(--ink-3)">On the radar · not planned</span><h3>Quantum optimization</h3><p class="sub">QUBO / QAOA formulations of vehicle routing and loading (IBM and others). Our current problems are polynomial, so there is nothing to gain yet; worth revisiting for ride pooling or truck routing with capacity.</p></div>
      </div>`));
  };

  // ---------------------------------------------------------------- start
  activate(location.hash.slice(1) || "overview");
})();
