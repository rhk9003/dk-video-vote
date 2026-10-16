(function () {
  "use strict";

  const CFG = window.VOTE_CONFIG;
  const VIDEOS = window.VIDEOS;
  const $ = s => document.querySelector(s);

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === "text") n.textContent = v;
      else if (k === "style") n.style.cssText = v;
      else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
    });
    (children || []).forEach(c => c && n.appendChild(c));
    return n;
  }

  function fmtLen(sec) {
    const s = Math.round(sec);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  // 影片播放器：已發佈用 FB iframe，未發佈播 media/ 的檔案（跟投票頁一樣）
  function screenFor(v) {
    const box = el("div", { class: "screen" + (v.orient === "landscape" ? " landscape" : "") });
    if (v.status === "published") {
      box.appendChild(el("iframe", {
        src: "https://www.facebook.com/plugins/video.php?href=" + encodeURIComponent(v.reel) + "&show_text=false&width=300&t=0",
        title: "No." + v.no + " 影片", loading: "lazy",
        allow: "autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share",
        allowfullscreen: "true", scrolling: "no",
      }));
    } else {
      box.appendChild(el("video", { src: v.mp4, poster: v.poster, controls: "", preload: "none", playsinline: "", title: "No." + v.no + " 影片" }));
    }
    return box;
  }

  // 影片播放器只建一次，重新整理時搬動位置就好，不會打斷正在播的影片
  const items = new Map();
  function itemFor(v) {
    if (items.has(v.key)) return items.get(v.key);
    const info = el("div", { class: "board-info" });
    const li = el("li", { class: "board-item" + (v.orient === "landscape" ? " is-landscape" : ""), id: "v-" + v.key }, [screenFor(v), info]);
    const it = { li, info };
    items.set(v.key, it);
    return it;
  }

  function sortedDepts(obj) {
    return Object.entries(obj || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hant"));
  }

  function render(data) {
    const voters = data.voters || 0;
    const res = data.videos || {};
    const get = k => res[k] || { votes: 0, depts: {}, notes: [] };
    const noteCount = VIDEOS.reduce((n, v) => n + get(v.key).notes.length, 0);
    const depts = sortedDepts(data.depts);

    $("#stats").replaceChildren(stat(voters, "人投票"), stat(depts.length, "個部門參與"), stat(noteCount, "則修改建議"));
    $("#depts").replaceChildren(...depts.map(([d, n]) => el("li", { text: d + " " + n + " 人" })));

    const ranked = VIDEOS.slice().sort((a, b) => get(b.key).votes - get(a.key).votes || a.no.localeCompare(b.no));
    const top = Math.max(1, ...ranked.map(v => get(v.key).votes));
    let lastN = null, pos = 0;
    const board = $("#board");
    ranked.forEach((v, i) => {
      const r = get(v.key);
      if (r.votes !== lastN) { pos = i + 1; lastN = r.votes; }
      const pct = voters ? Math.round(r.votes / voters * 100) : 0;
      const it = itemFor(v);
      it.li.classList.toggle("is-top", r.votes > 0 && pos <= 3);
      const deptChips = sortedDepts(r.depts);
      it.info.replaceChildren(
        el("div", { class: "board-head" }, [
          el("span", { class: "board-pos", text: r.votes ? "第 " + pos + " 名" : "未得票" }),
          el("span", { class: "board-no", text: "No." + v.no + "・" + fmtLen(v.length) + (v.status === "published" ? "・" + v.date + " 發佈" : "・未發佈") }),
        ]),
        el("h3", { text: v.title }),
        el("p", { class: "product", text: v.product }),
        el("div", { class: "meter" }, [
          el("div", { class: "track-bar" }, [el("div", { class: "fill", style: "width:" + (r.votes / top * 100) + "%" })]),
          el("span", { class: "n", text: r.votes + " 票・" + pct + "%" }),
        ]),
        deptChips.length ? el("p", { class: "board-depts", text: "投票部門：" + deptChips.map(([d, n]) => d + " " + n).join("、") }) : null,
        el("div", { class: "board-notes" }, [
          el("p", { class: "board-notes-title", text: r.notes.length ? "修改建議（" + r.notes.length + " 則）" : "還沒有修改建議" }),
          r.notes.length ? el("ul", {}, r.notes.map(n => el("li", {}, [
            el("span", { class: "by", text: n.dept + (n.picked ? "・有投這支" : "") }),
            document.createTextNode(n.text),
          ]))) : null,
        ]),
      );
      board.appendChild(it.li); // 依名次重新排列
    });

    const d = new Date(data.updated || Date.now());
    $("#updated").textContent = "更新時間 " + d.toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function stat(n, label) {
    return el("div", { class: "stat" }, [el("b", { text: String(n) }), el("span", { text: label })]);
  }

  async function load() {
    const btn = $("#refresh");
    btn.disabled = true; btn.textContent = "讀取中…";
    $("#board-msg").textContent = "";
    try {
      const res = await fetch(CFG.scriptUrl, { method: "POST", body: JSON.stringify({ action: "public" }) });
      const data = await res.json();
      if (!data.ok || typeof data.voters !== "number") throw new Error(data.error || "結果還沒準備好");
      render(data);
    } catch (err) {
      $("#updated").textContent = "";
      $("#board-msg").textContent = "讀不到票選結果（" + err.message + "），請稍後按「重新整理」再試一次。";
    } finally {
      btn.disabled = false; btn.textContent = "重新整理";
    }
  }

  $("#refresh").addEventListener("click", load);
  load();
})();
