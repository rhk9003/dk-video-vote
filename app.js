(function () {
  "use strict";

  const CFG = window.VOTE_CONFIG;
  const VIDEOS = window.VIDEOS;
  const GROUPS = window.GROUPS;
  const MAX = CFG.maxPicks;
  const STORE_KEY = "dk-video-vote.v1";

  // ── 本機暫存（只是方便，讀寫失敗也能正常用） ──
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 無痕模式等情況，略過 */ }
  }

  const saved = load();
  const validKeys = new Set(VIDEOS.map(v => v.key));
  const state = {
    dept: saved.dept || "",
    name: saved.name || "",
    picks: (saved.picks || []).filter(k => validKeys.has(k)).slice(0, MAX),
    notes: saved.notes || {},
    submitted: saved.submitted || null,
  };

  const $ = sel => document.querySelector(sel);
  const steps = { who: $("#step-who"), vote: $("#step-vote"), done: $("#step-done") };

  function show(step) {
    Object.entries(steps).forEach(([k, el]) => { el.hidden = k !== step; });
    window.scrollTo(0, 0);
  }

  function fmtLen(sec) {
    const s = Math.round(sec);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function label(v) { return "No." + v.no + " " + v.title; }
  function byKey(k) { return VIDEOS.find(v => v.key === k); }

  document.querySelectorAll(".max-picks").forEach(el => { el.textContent = MAX; });
  $("#total-videos").textContent = VIDEOS.length;

  // ── 步驟一 ──
  const whoForm = $("#who-form");
  $("#dept").value = state.dept;
  $("#name").value = state.name;
  whoForm.addEventListener("submit", e => {
    e.preventDefault();
    const dept = $("#dept").value.trim();
    const name = $("#name").value.trim();
    if (!dept || !name) {
      $("#who-msg").textContent = !dept ? "請填所屬部門。" : "請填姓名。";
      (!dept ? $("#dept") : $("#name")).focus();
      return;
    }
    $("#who-msg").textContent = "";
    // 換人用同一台電腦時，不要沿用上一個人選的影片和建議
    if ((state.dept || state.name) && (state.dept !== dept || state.name !== name)) {
      state.picks = []; state.notes = {}; state.submitted = null;
      VIDEOS.forEach(v => { const ta = document.getElementById("note-" + v.key); if (ta) ta.value = ""; });
      renderPicks(); renderSummary();
    }
    state.dept = dept; state.name = name; save();
    $("#voter-label").textContent = dept + "・" + name;
    show("vote");
  });
  $("#edit-who").addEventListener("click", () => show("who"));

  // ── 影片卡 ──
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === "text") n.textContent = v;
      else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
    });
    (children || []).forEach(c => c && n.appendChild(c));
    return n;
  }

  function screenFor(v) {
    const box = el("div", { class: "screen" + (v.orient === "landscape" ? " landscape" : "") });
    if (v.status === "published") {
      const src = "https://www.facebook.com/plugins/video.php?href=" + encodeURIComponent(v.reel) +
        "&show_text=false&width=300&t=0";
      box.appendChild(el("iframe", {
        src, title: "No." + v.no + " 影片", loading: "lazy",
        allow: "autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share",
        allowfullscreen: "true", scrolling: "no",
      }));
    } else {
      box.appendChild(el("video", {
        src: v.mp4, poster: v.poster, controls: "", preload: "none", playsinline: "",
        title: "No." + v.no + " 影片",
      }));
    }
    return box;
  }

  function statusText(v) {
    if (v.status === "published") return null;
    if (v.status === "uploaded") return "已上傳未發佈";
    return "未發佈";
  }

  const cards = {};
  function buildCards() {
    const root = $("#groups");
    GROUPS.forEach(g => {
      const list = VIDEOS.filter(v => v.group === g.key);
      if (!list.length) return;
      const section = el("section", { class: "group", "aria-labelledby": "g-" + g.key }, [
        el("h2", { id: "g-" + g.key, text: g.title }),
        el("p", { class: "muted", text: g.desc }),
      ]);
      const ol = el("ol", { class: "tracks" });
      list.forEach(v => {
        const pickBtn = el("button", { type: "button", class: "pick", "aria-pressed": "false" });
        const ta = el("textarea", { id: "note-" + v.key, maxlength: "1000", placeholder: "例：前 3 秒太慢、字卡太小、想換成線上獨家的說法…" });
        ta.value = state.notes[v.key] || "";
        const badge = statusText(v);
        const head = el("div", { class: "track-head" }, [
          el("span", { class: "no", text: "No." + v.no }),
          el("span", { text: v.date ? v.date + " 發佈" : "" }),
          el("span", { text: fmtLen(v.length) }),
          badge ? el("span", { class: "badge", text: badge }) : null,
        ]);
        const details = el("details", {}, [
          el("summary", { text: "看貼文文案" }),
          v.capnote ? el("p", { class: "capnote", text: v.capnote }) : null,
          el("p", { class: "caption", text: v.caption }),
        ]);
        const extra = [];
        if (v.note) extra.push(el("p", { class: "fileinfo", text: v.note }));
        if (v.file) extra.push(el("p", { class: "fileinfo", text: "成片檔名：" + v.file }));
        if (v.reel && v.status === "published") {
          extra.push(el("p", { class: "fileinfo" }, [el("a", { href: v.reel, target: "_blank", rel: "noopener", text: "在 Facebook 開啟" })]));
        }
        const li = el("li", { class: "track" + (v.orient === "landscape" ? " wide" : ""), id: "v-" + v.key }, [
          head,
          screenFor(v),
          el("h3", { text: v.title }),
          el("p", { class: "product", text: v.product }),
          ...extra,
          details,
          pickBtn,
          el("label", { class: "note", for: "note-" + v.key }, [el("span", { text: "修改建議（選填）" })]),
          ta,
        ]);
        pickBtn.addEventListener("click", () => togglePick(v.key));
        let t;
        ta.addEventListener("input", () => {
          clearTimeout(t);
          t = setTimeout(() => {
            const val = ta.value.trim();
            if (val) state.notes[v.key] = ta.value; else delete state.notes[v.key];
            save(); renderSummary();
          }, 300);
        });
        cards[v.key] = { li, pickBtn };
        ol.appendChild(li);
      });
      section.appendChild(ol);
      root.appendChild(section);
    });
  }

  let hintTimer;
  function hint(msg) {
    const h = $("#bar-hint");
    h.textContent = msg;
    clearTimeout(hintTimer);
    if (msg) hintTimer = setTimeout(() => { h.textContent = ""; }, 4000);
  }

  function togglePick(key) {
    const i = state.picks.indexOf(key);
    if (i >= 0) state.picks.splice(i, 1);
    else if (state.picks.length >= MAX) { hint("最多選 " + MAX + " 支，先取消一支再選這支。"); return; }
    else state.picks.push(key);
    hint("");
    save(); renderPicks(); renderSummary();
  }

  function renderPicks() {
    VIDEOS.forEach(v => {
      const c = cards[v.key]; if (!c) return;
      const on = state.picks.includes(v.key);
      c.pickBtn.setAttribute("aria-pressed", on ? "true" : "false");
      c.pickBtn.textContent = on ? "已選這支（再按一次取消）" : "選這支放大投放";
      c.li.classList.toggle("is-picked", on);
    });
    $("#pick-count").textContent = state.picks.length;
  }

  function summaryNode(picks, notes) {
    const frag = document.createDocumentFragment();
    const ul = el("ul", { class: "summary-list" });
    if (picks.length) {
      picks.forEach(k => { const v = byKey(k); if (v) ul.appendChild(el("li", {}, [el("b", { text: label(v) })])); });
    } else {
      ul.appendChild(el("li", { text: "還沒選影片" }));
    }
    frag.appendChild(el("p", { class: "muted", text: "選的影片（" + picks.length + " / " + MAX + "）" }));
    frag.appendChild(ul);
    const noteKeys = VIDEOS.map(v => v.key).filter(k => (notes[k] || "").trim());
    frag.appendChild(el("p", { class: "muted", text: "修改建議：" + (noteKeys.length ? noteKeys.length + " 支影片有寫" : "沒有寫") }));
    if (noteKeys.length) {
      const nl = el("ul", { class: "summary-list" });
      noteKeys.forEach(k => nl.appendChild(el("li", {}, [el("b", { text: "No." + byKey(k).no + "：" }), document.createTextNode(notes[k].trim())])));
      frag.appendChild(nl);
    }
    return frag;
  }

  function renderSummary() {
    const box = $("#summary");
    box.replaceChildren(summaryNode(state.picks, state.notes));
  }

  // ── 送出 ──
  let sending = false;
  async function submit() {
    if (sending) return;
    const msg = $("#submit-msg");
    if (!state.picks.length) {
      msg.textContent = "至少要選 1 支影片才能送出。";
      hint("至少要選 1 支影片才能送出。");
      msg.scrollIntoView({ block: "center" });
      return;
    }
    if (!CFG.scriptUrl) {
      msg.textContent = "投票還沒開放：管理者還沒接上收票的試算表。你填的內容已經存在這台電腦，開放後回來直接按送出就好。";
      msg.scrollIntoView({ block: "center" });
      return;
    }
    const notes = {};
    Object.keys(state.notes).forEach(k => { const t = (state.notes[k] || "").trim(); if (t && validKeys.has(k)) notes[k] = t; });
    const labels = {};
    VIDEOS.forEach(v => { labels[v.key] = label(v); });
    const payload = { action: "vote", dept: state.dept, name: state.name, picks: state.picks.slice(), notes, labels };

    sending = true;
    setSending(true);
    msg.textContent = "";
    try {
      const res = await fetch(CFG.scriptUrl, { method: "POST", body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "試算表沒有收下這筆投票");
      state.submitted = { at: new Date().toISOString(), picks: payload.picks, notes };
      save();
      $("#done-summary").replaceChildren(summaryNode(payload.picks, notes));
      show("done");
    } catch (err) {
      msg.textContent = "送出失敗（" + err.message + "）。請檢查網路後再按一次送出；你填的內容都還在。";
      msg.scrollIntoView({ block: "center" });
    } finally {
      sending = false;
      setSending(false);
    }
  }
  function setSending(on) {
    ["#submit-top", "#submit-bottom"].forEach(s => {
      const b = $(s); b.disabled = on; b.textContent = on ? "送出中…" : "送出投票";
    });
  }
  $("#submit-top").addEventListener("click", submit);
  $("#submit-bottom").addEventListener("click", submit);
  $("#back-to-vote").addEventListener("click", () => show("vote"));

  // ── 開場 ──
  buildCards();
  renderPicks();
  renderSummary();
  // 一律從填部門姓名開始（上次填過的會先帶入）
  show("who");
})();
