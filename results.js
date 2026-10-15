(function () {
  "use strict";

  const CFG = window.VOTE_CONFIG;
  const VIDEOS = window.VIDEOS;
  const PW_KEY = "dk-video-vote.results-pw";
  const $ = s => document.querySelector(s);

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === "text") n.textContent = v;
      else if (k === "style") n.style.cssText = v;
      else if (v !== null && v !== undefined) n.setAttribute(k, v);
    });
    (children || []).forEach(c => c && n.appendChild(c));
    return n;
  }

  let password = "";
  try { password = sessionStorage.getItem(PW_KEY) || ""; } catch (e) { /* 略過 */ }

  async function fetchRows() {
    if (!CFG.scriptUrl) throw new Error("還沒設定收票網址（config.js 的 scriptUrl）");
    const res = await fetch(CFG.scriptUrl, { method: "POST", body: JSON.stringify({ action: "results", password }) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "讀不到資料");
    return data.rows;
  }

  // 同一個人（部門＋姓名）只取最後一次送出
  function latestPerPerson(rows) {
    const map = new Map();
    rows.slice().sort((a, b) => String(a.t).localeCompare(String(b.t))).forEach(r => {
      const k = String(r.dept).trim() + "|" + String(r.name).trim();
      map.set(k, r);
    });
    return [...map.values()];
  }

  function render(rows) {
    const people = latestPerPerson(rows);
    const tally = new Map(VIDEOS.map(v => [v.key, []]));
    people.forEach(p => (p.picks || []).forEach(k => { if (tally.has(k)) tally.get(k).push(p); }));

    // 摘要
    const noteCount = people.reduce((n, p) => n + Object.keys(p.notes || {}).length, 0);
    $("#stats").replaceChildren(
      stat(people.length, "人投票"),
      stat(rows.length, "次送出"),
      stat(noteCount, "則修改建議"),
    );
    const depts = new Map();
    people.forEach(p => depts.set(p.dept, (depts.get(p.dept) || 0) + 1));
    $("#depts").replaceChildren(...[...depts.entries()].sort((a, b) => b[1] - a[1])
      .map(([d, n]) => el("li", { text: d + " " + n + " 人" })));

    // 排行
    const ranked = VIDEOS.slice().sort((a, b) => tally.get(b.key).length - tally.get(a.key).length || a.no.localeCompare(b.no));
    const top = Math.max(1, ...ranked.map(v => tally.get(v.key).length));
    let lastN = null, pos = 0;
    $("#rank").replaceChildren(...ranked.map((v, i) => {
      const voters = tally.get(v.key);
      const n = voters.length;
      if (n !== lastN) { pos = i + 1; lastN = n; }
      const pct = people.length ? Math.round(n / people.length * 100) : 0;
      return el("li", {}, [
        el("span", { class: "pos", text: n ? String(pos).padStart(2, "0") : "—" }),
        el("div", { class: "body" }, [
          el("div", { class: "t" }, [el("small", { text: "No." + v.no }), document.createTextNode(v.title)]),
          el("div", { class: "muted", style: "font-size:13px", text: v.product + (v.status === "published" ? "・" + v.date + " 發佈" : "・未發佈") }),
          el("div", { class: "meter" }, [
            el("div", { class: "track-bar" }, [el("div", { class: "fill", style: "width:" + (n / top * 100) + "%" })]),
            el("span", { class: "n", text: n + " 票・" + pct + "%" }),
          ]),
          n ? el("div", { class: "who-list", text: voters.map(p => p.dept + " " + p.name).join("、") }) : null,
        ]),
      ]);
    }));

    // 修改建議
    const notesRoot = $("#notes");
    const blocks = VIDEOS.map(v => {
      const items = people.filter(p => (p.notes || {})[v.key]).map(p => el("li", {}, [
        el("span", { class: "by", text: p.dept + " " + p.name + ((p.picks || []).includes(v.key) ? "・有投這支" : "") }),
        document.createTextNode(p.notes[v.key]),
      ]));
      if (!items.length) return null;
      return el("div", { class: "notes-video" }, [
        el("h3", { text: "No." + v.no + " " + v.title + "（" + items.length + " 則）" }),
        el("ul", {}, items),
      ]);
    }).filter(Boolean);
    notesRoot.replaceChildren(...(blocks.length ? blocks : [el("p", { class: "muted", text: "還沒有人寫修改建議。" })]));

    $("#updated").textContent = "更新時間 " + new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
  }

  function stat(n, label) {
    return el("div", { class: "stat" }, [el("b", { text: String(n) }), el("span", { text: label })]);
  }

  async function loadAndRender() {
    const btn = $("#refresh");
    btn.disabled = true; btn.textContent = "讀取中…";
    try {
      render(await fetchRows());
      $("#pw-form").hidden = true;
      $("#results").hidden = false;
    } catch (err) {
      $("#pw-form").hidden = false;
      $("#results").hidden = true;
      $("#pw-msg").textContent = err.message === "密碼不對" ? "密碼不對，請再確認一次。" : "讀取失敗：" + err.message;
    } finally {
      btn.disabled = false; btn.textContent = "重新整理";
    }
  }

  $("#pw-form").addEventListener("submit", e => {
    e.preventDefault();
    password = $("#pw").value;
    if (!password) { $("#pw-msg").textContent = "請輸入密碼。"; return; }
    $("#pw-msg").textContent = "";
    try { sessionStorage.setItem(PW_KEY, password); } catch (err) { /* 略過 */ }
    loadAndRender();
  });
  $("#refresh").addEventListener("click", loadAndRender);

  if (password) loadAndRender();
})();
