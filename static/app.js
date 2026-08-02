(() => {
  const STORAGE_KEY = "pi-debate-workflows";
  const PREVIEW_LEN = 160;

  const stage = document.getElementById("stage");
  const form = document.getElementById("debate-form");
  const input = document.getElementById("question");
  const submit = document.getElementById("submit");
  const inputZone = document.getElementById("input-zone");
  const feed = document.getElementById("feed");
  const timeline = document.getElementById("timeline");
  const statusLine = document.getElementById("status-line");
  const questionEcho = document.getElementById("question-echo");
  const finalBlock = document.getElementById("final-block");
  const finalBody = document.getElementById("final-body");
  const resetBtn = document.getElementById("reset");
  const clock = document.getElementById("clock");
  const hint = document.getElementById("hint");
  const historyToggle = document.getElementById("history-toggle");
  const historyClose = document.getElementById("history-close");
  const historyPanel = document.getElementById("history-panel");
  const historyList = document.getElementById("history-list");
  const historyEmpty = document.getElementById("history-empty");
  const backLive = document.getElementById("back-live");

  const agents = ["scientist", "philosopher"];
  let busy = false;
  let viewingId = null;
  let current = null;

  function uid() {
    return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveHistory(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function upsertWorkflow(workflow) {
    const items = loadHistory().filter((w) => w.id !== workflow.id);
    items.unshift(workflow);
    saveHistory(items.slice(0, 50));
    renderHistoryList();
  }

  function setClock() {
    clock.textContent = new Date().toTimeString().slice(0, 8);
  }
  setClock();
  setInterval(setClock, 1000);

  function setStatus(text) {
    statusLine.textContent = text;
  }

  function truncate(text) {
    const clean = (text || "").trim().replace(/\s+/g, " ");
    if (clean.length <= PREVIEW_LEN) return { preview: clean, clipped: false };
    return { preview: `${clean.slice(0, PREVIEW_LEN).trimEnd()}...`, clipped: true };
  }

  function ensureAgentCard(agent) {
    let el = document.getElementById(`agent-${agent}`);
    if (el) return el;

    el = document.createElement("button");
    el.type = "button";
    el.className = "agent-card pending";
    el.id = `agent-${agent}`;
    el.innerHTML = `
      <p class="mono label">
        <span>${agent}</span>
        <span class="state" data-state>queued</span>
      </p>
      <div class="body pending-text clamp" data-body>awaiting stream…</div>
      <span class="mono ellipsis hidden" data-more>expand</span>
    `;
    el.addEventListener("click", () => toggleCard(el));
    timeline.appendChild(el);
    return el;
  }

  function toggleCard(el) {
    if (el.classList.contains("pending")) return;
    const full = el.dataset.full || "";
    if (!full) return;

    const expanded = el.classList.toggle("expanded");
    const body = el.querySelector("[data-body]");
    const more = el.querySelector("[data-more]");

    if (expanded) {
      body.className = "body full";
      body.textContent = full;
      more.textContent = "collapse";
      more.classList.remove("hidden");
    } else {
      const { preview, clipped } = truncate(full);
      body.className = "body clamp";
      body.textContent = preview;
      more.textContent = "expand";
      more.classList.toggle("hidden", !clipped);
    }
  }

  function markPending(agent) {
    const el = ensureAgentCard(agent);
    el.classList.add("pending");
    el.classList.remove("expanded");
    el.dataset.full = "";
    el.querySelector("[data-state]").textContent = "running";
    const body = el.querySelector("[data-body]");
    body.className = "body pending-text clamp";
    body.textContent = "streaming…";
    el.querySelector("[data-more]").classList.add("hidden");
  }

  function fillAgent(agent, content) {
    const el = ensureAgentCard(agent);
    const full = (content || "").trim();
    el.classList.remove("pending", "expanded");
    el.dataset.full = full;
    el.querySelector("[data-state]").textContent = "done";

    const { preview, clipped } = truncate(full);
    const body = el.querySelector("[data-body]");
    body.className = "body clamp";
    body.textContent = preview;

    const more = el.querySelector("[data-more]");
    more.textContent = "expand";
    more.classList.toggle("hidden", !clipped);

    if (current) {
      current.agents[agent] = full;
      upsertWorkflow(current);
    }
  }

  function showFeed(question, { archive = false } = {}) {
    inputZone.classList.add("exit");
    setTimeout(() => {
      inputZone.classList.add("hidden");
      feed.classList.remove("hidden");
    }, 280);

    stage.classList.add("is-feed");
    questionEcho.textContent = question;
    timeline.innerHTML = "";
    finalBlock.classList.add("hidden");
    finalBody.textContent = "";
    backLive.classList.add("hidden");
    viewingId = null;

    if (!archive) {
      agents.forEach(markPending);
    }

    if (window.setParticleIntensity) window.setParticleIntensity(0.95);
  }

  function showHome() {
    busy = false;
    submit.disabled = false;
    viewingId = null;
    current = null;
    feed.classList.add("hidden");
    stage.classList.remove("is-feed");
    inputZone.classList.remove("hidden", "exit");
    timeline.innerHTML = "";
    finalBlock.classList.add("hidden");
    finalBody.textContent = "";
    backLive.classList.add("hidden");
    setStatus("idle");
    hint.textContent = "scientist · philosopher · judge";
    input.value = "";
    input.focus();
    if (window.setParticleIntensity) window.setParticleIntensity(0.55);
    renderHistoryList();
  }

  function archiveCurrentIfNeeded() {
    if (!current || !current.question) return;
    const hasContent =
      current.judge ||
      Object.values(current.agents || {}).some(Boolean);
    if (!hasContent) return;
    current.updatedAt = new Date().toISOString();
    upsertWorkflow(current);
  }

  function startNewWorkflow() {
    if (busy) return;
    archiveCurrentIfNeeded();
    showHome();
  }

  function renderHistoryList() {
    const items = loadHistory();
    historyList.innerHTML = "";
    historyEmpty.classList.toggle("hidden", items.length > 0);

    items.forEach((wf) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "history-item";
      if (viewingId === wf.id || (current && current.id === wf.id && !viewingId)) {
        btn.classList.add("active");
      }

      const when = new Date(wf.createdAt);
      const stamp = when.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      btn.innerHTML = `
        <span class="q">${escapeHtml(wf.question)}</span>
        <span class="mono meta-row">
          <span>${wf.status || "saved"}</span>
          <span>${stamp}</span>
        </span>
      `;
      btn.addEventListener("click", () => openWorkflow(wf.id));
      li.appendChild(btn);
      historyList.appendChild(li);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function openWorkflow(id) {
    const wf = loadHistory().find((w) => w.id === id);
    if (!wf) return;

    if (busy) return;
    archiveCurrentIfNeeded();

    viewingId = id;
    current = null;
    historyPanel.classList.add("hidden");

    stage.classList.add("is-feed");
    inputZone.classList.add("hidden", "exit");
    feed.classList.remove("hidden");
    backLive.classList.remove("hidden");

    questionEcho.textContent = wf.question;
    timeline.innerHTML = "";
    setStatus(`workflow · ${wf.status || "saved"}`);

    agents.forEach((agent) => {
      const text = (wf.agents && wf.agents[agent]) || "";
      if (text) fillAgentReadonly(agent, text);
      else {
        ensureAgentCard(agent);
        const el = document.getElementById(`agent-${agent}`);
        el.classList.remove("pending");
        el.querySelector("[data-state]").textContent = "empty";
        el.querySelector("[data-body]").textContent = "no output";
      }
    });

    if (wf.judge) {
      finalBody.textContent = wf.judge;
      finalBlock.classList.remove("hidden");
    } else {
      finalBlock.classList.add("hidden");
      finalBody.textContent = "";
    }

    if (window.setParticleIntensity) window.setParticleIntensity(0.35);
    renderHistoryList();
  }

  function fillAgentReadonly(agent, content) {
    const el = ensureAgentCard(agent);
    const full = content.trim();
    el.classList.remove("pending", "expanded");
    el.dataset.full = full;
    el.querySelector("[data-state]").textContent = "done";
    const { preview, clipped } = truncate(full);
    const body = el.querySelector("[data-body]");
    body.className = "body clamp";
    body.textContent = preview;
    const more = el.querySelector("[data-more]");
    more.textContent = "expand";
    more.classList.toggle("hidden", !clipped);
  }

  function parseSSEChunk(buffer, onEvent) {
    const parts = buffer.split("\n\n");
    const rest = parts.pop() ?? "";

    for (const part of parts) {
      if (!part.trim()) continue;
      let event = "message";
      const dataLines = [];
      for (const line of part.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) continue;
      try {
        onEvent(event, JSON.parse(dataLines.join("\n")));
      } catch {
        /* ignore malformed chunk */
      }
    }
    return rest;
  }

  async function runDebate(question) {
    busy = true;
    submit.disabled = true;
    viewingId = null;

    current = {
      id: uid(),
      question,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "running",
      agents: {},
      judge: "",
    };
    upsertWorkflow(current);

    showFeed(question);
    setStatus("controller · starting");
    backLive.classList.add("hidden");

    const res = await fetch("/api/debate/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ question }),
    });

    if (!res.ok || !res.body) {
      setStatus("error · request failed");
      if (current) {
        current.status = "error";
        upsertWorkflow(current);
      }
      busy = false;
      submit.disabled = false;
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = parseSSEChunk(buffer, handleEvent);
    }

    if (current && current.status === "running") {
      current.status = "complete";
      current.updatedAt = new Date().toISOString();
      upsertWorkflow(current);
    }

    busy = false;
    submit.disabled = false;
  }

  function handleEvent(event, data) {
    if (event === "status") {
      setStatus(`${data.label || data.phase} · ${data.message}`);
      return;
    }

    if (event === "agent") {
      setStatus(`${data.agent} · done`);
      fillAgent(data.agent, data.content || "");
      return;
    }

    if (event === "final") {
      setStatus("judge · final");
      const text = (data.content || "").trim();
      finalBody.textContent = text;
      finalBlock.classList.remove("hidden");
      if (current) {
        current.judge = text;
        current.status = "complete";
        current.updatedAt = new Date().toISOString();
        upsertWorkflow(current);
      }
      if (window.setParticleIntensity) window.setParticleIntensity(0.35);
      return;
    }

    if (event === "done") {
      setStatus("complete");
      if (current) {
        current.status = "complete";
        current.updatedAt = new Date().toISOString();
        upsertWorkflow(current);
      }
      return;
    }

    if (event === "error") {
      setStatus(`error · ${data.message || "failed"}`);
      if (current) {
        current.status = "error";
        upsertWorkflow(current);
      }
      const err = ensureAgentCard("system");
      err.classList.remove("pending");
      err.querySelector("[data-state]").textContent = "error";
      err.querySelector("[data-body]").textContent = data.message || "Debate failed.";
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) return;
    const question = input.value.trim();
    if (!question) return;
    runDebate(question).catch((err) => {
      setStatus("error · network");
      console.error(err);
      if (current) {
        current.status = "error";
        upsertWorkflow(current);
      }
      busy = false;
      submit.disabled = false;
    });
  });

  resetBtn.addEventListener("click", startNewWorkflow);

  backLive.addEventListener("click", () => {
    if (busy) return;
    showHome();
  });

  function closeHistory() {
    historyPanel.classList.add("hidden");
  }

  function openHistory() {
    historyPanel.classList.remove("hidden");
    renderHistoryList();
  }

  historyToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (historyPanel.classList.contains("hidden")) openHistory();
    else closeHistory();
  });

  historyClose.addEventListener("click", (e) => {
    e.stopPropagation();
    closeHistory();
  });

  historyPanel.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", () => {
    if (!historyPanel.classList.contains("hidden")) closeHistory();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeHistory();
  });

  renderHistoryList();
  input.focus();
})();
