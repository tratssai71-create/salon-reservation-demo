// ==============================================
// サロン予約システム 管理画面ロジック
// 予約確認・時間のブロック・メニュー/スタッフ/営業時間・パスワード変更
// デモモード（config.js の API_URL が空）では利用できません。
// ==============================================

(() => {
  const CFG = SALON_CONFIG;
  const isDemo = !CFG.API_URL;
  const DOW_JA = ["日", "月", "火", "水", "木", "金", "土"];

  let adminPassword = sessionStorage.getItem("salon_admin_password") || "";
  let config = null;
  let activeTab = "reservations";

  const $demoNotice = document.getElementById("demoNotice");
  const $loginScreen = document.getElementById("loginScreen");
  const $loginPassword = document.getElementById("loginPassword");
  const $loginError = document.getElementById("loginError");
  const $loginBtn = document.getElementById("loginBtn");
  const $dashboard = document.getElementById("dashboard");
  const $adminTabs = document.getElementById("adminTabs");
  const $adminContainer = document.getElementById("adminContainer");
  const $adminSalonName = document.getElementById("adminSalonName");

  function pad2(n) { return String(n).padStart(2, "0"); }
  function todayKey() {
    const t = new Date();
    return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
  }
  function fmtDateTime(iso) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}（${DOW_JA[d.getDay()]}）${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function newId(prefix) { return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`; }

  // ---------- API ----------
  async function apiGet(params) {
    const qs = new URLSearchParams({ ...params, adminPassword }).toString();
    const res = await fetch(`${CFG.API_URL}?${qs}`);
    return res.json();
  }
  async function apiPost(action, body) {
    const res = await fetch(CFG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, adminPassword, ...body }),
    });
    return res.json();
  }

  // ---------- 起動 ----------
  async function init() {
    if (isDemo) {
      $demoNotice.style.display = "block";
      $loginScreen.style.display = "none";
      return;
    }
    if (adminPassword) {
      const ok = await tryLogin();
      if (ok) return;
    }
    $loginScreen.style.display = "block";
  }

  async function tryLogin() {
    try {
      const res = await apiPost("adminLogin", {});
      if (res.success) {
        await loadConfig();
        $loginScreen.style.display = "none";
        $dashboard.style.display = "block";
        renderTab();
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    sessionStorage.removeItem("salon_admin_password");
    adminPassword = "";
    return false;
  }

  async function loadConfig() {
    const res = await apiGet({ action: "getConfig" });
    if (res.success) {
      config = res.config;
      $adminSalonName.textContent = `${config.salonName} 管理画面`;
    }
  }

  $loginBtn.addEventListener("click", async () => {
    adminPassword = $loginPassword.value.trim();
    $loginBtn.disabled = true;
    $loginBtn.textContent = "確認中…";
    const ok = await tryLogin();
    $loginBtn.disabled = false;
    $loginBtn.textContent = "ログイン";
    if (ok) {
      sessionStorage.setItem("salon_admin_password", adminPassword);
      $loginError.style.display = "none";
    } else {
      $loginError.style.display = "block";
    }
  });
  $loginPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") $loginBtn.click(); });

  // ---------- タブ切り替え ----------
  $adminTabs.querySelectorAll(".admin-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      $adminTabs.querySelectorAll(".admin-tab").forEach((b) => b.classList.toggle("active", b === btn));
      renderTab();
    });
  });

  function renderTab() {
    if (activeTab === "reservations") renderReservations();
    else if (activeTab === "block") renderBlock();
    else if (activeTab === "menu") renderMenu();
    else if (activeTab === "settings") renderSettings();
  }

  function msgHtml(id) { return `<div id="${id}"></div>`; }
  function showMsg(id, text, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<div class="admin-msg ${ok ? "admin-msg--ok" : "admin-msg--err"}">${text}</div>`;
    if (ok) setTimeout(() => { el.innerHTML = ""; }, 3000);
  }

  // ---------- 予約一覧 ----------
  async function renderReservations() {
    $adminContainer.innerHTML = `
      <div class="admin-section-head"><h2>予約一覧</h2></div>
      ${msgHtml("resMsg")}
      <div class="loading">読み込み中…</div>
    `;
    const from = todayKey();
    const to = addDays(from, 60);
    const res = await apiGet({ action: "getReservations", from, to });
    if (!res.success) {
      $adminContainer.querySelector(".loading").outerHTML = `<p class="empty-msg">読み込みに失敗しました</p>`;
      return;
    }
    const list = res.reservations || [];
    if (list.length === 0) {
      $adminContainer.querySelector(".loading").outerHTML = `<p class="empty-msg">今後60日以内の予約・ブロックはありません</p>`;
      return;
    }
    const rows = list.map((r) => `
      <tr>
        <td>${fmtDateTime(r.start)}<br>〜 ${fmtDateTime(r.end)}</td>
        <td><span class="badge ${r.type === "blocked" ? "badge--blocked" : "badge--reservation"}">${r.type === "blocked" ? "ブロック" : "予約"}</span></td>
        <td>${r.title}<br><span style="color:var(--ink2);white-space:pre-line;font-size:0.78rem;">${(r.description || "").replace(/</g, "&lt;")}</span></td>
        <td><button class="btn btn-small btn-danger" data-id="${r.eventId}">削除</button></td>
      </tr>
    `).join("");
    $adminContainer.querySelector(".loading").outerHTML = `
      <table class="admin-table">
        <thead><tr><th>日時</th><th>種別</th><th>内容</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    $adminContainer.querySelectorAll("[data-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("この予定を削除しますか？")) return;
        btn.disabled = true;
        const r = await apiPost("adminCancelReservation", { eventId: btn.dataset.id });
        if (r.success) renderReservations();
        else showMsg("resMsg", "削除に失敗しました", false);
      });
    });
  }

  function addDays(dateStr, days) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d + days);
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  }
  function dowOfDateStr(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
  }
  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }
  function toHHMM(mins) {
    return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
  }
  function allTimeLabels() {
    const hours = config.businessHours.default;
    const openMin = toMinutes(hours.open);
    const closeMin = toMinutes(hours.close);
    const labels = [];
    for (let t = openMin; t < closeMin; t += config.slotIntervalMin) labels.push(toHHMM(t));
    return labels;
  }

  // ---------- 時間をブロック（カレンダー形式） ----------
  let blockGridOffset = 0;
  let selectMode = false;
  let selectedSlots = new Map(); // key: "date_time" -> { type: "open"|"blocked", date, time, eventId }

  function renderBlock() {
    $adminContainer.innerHTML = `
      <div class="admin-section-head">
        <h2>時間をブロック</h2>
        <button class="btn btn-small ${selectMode ? "btn-primary" : "btn-ghost"}" id="selectModeToggle">${selectMode ? "選択モードを終了" : "まとめて選択して変更"}</button>
      </div>
      <p style="color:var(--ink2);font-size:0.82rem;margin-top:-10px;">${selectMode ? "変更したいマスを複数タップして選んでから、下のボタンでまとめて反映します。" : "○をクリックするとその時間を予約不可にします。×（グレー）をクリックするとブロックを解除します。予約済み（オレンジ）はここからは操作できません。"}</p>
      ${msgHtml("blockMsg")}
      <div class="avail-nav">
        <button id="blockPrev">‹ 前の7日</button>
        <span class="avail-nav__label" id="blockNavLabel"></span>
        <button id="blockNext">次の7日 ›</button>
      </div>
      <div class="avail-scroll">
        <table class="avail-table">
          <thead id="blockThead"></thead>
          <tbody id="blockTbody"><tr><td class="empty-msg">読み込み中…</td></tr></tbody>
        </table>
      </div>
      <p class="avail-legend">○ 空き 　× ブロック中 　予 ご予約あり 　－ 定休日・受付終了</p>
      <div id="selectBar" class="select-bar" style="display:none;">
        <span id="selectCount">0件選択中</span>
        <div class="select-bar__btns">
          <button class="btn btn-small btn-primary" id="selectApplyBlock">選んだ枠をブロックする</button>
          <button class="btn btn-small btn-ghost" id="selectApplyUnblock">選んだ枠を解除する</button>
          <button class="btn btn-small btn-ghost" id="selectClear">選択解除</button>
        </div>
      </div>
    `;
    document.getElementById("blockPrev").addEventListener("click", () => {
      blockGridOffset = Math.max(0, blockGridOffset - 7);
      refreshBlockTable();
    });
    document.getElementById("blockNext").addEventListener("click", () => {
      blockGridOffset += 7;
      refreshBlockTable();
    });
    document.getElementById("selectModeToggle").addEventListener("click", () => {
      selectMode = !selectMode;
      selectedSlots.clear();
      renderBlock();
    });
    document.getElementById("selectClear").addEventListener("click", () => {
      selectedSlots.clear();
      refreshBlockTable();
    });
    document.getElementById("selectApplyBlock").addEventListener("click", () => applySelection_("block"));
    document.getElementById("selectApplyUnblock").addEventListener("click", () => applySelection_("unblock"));
    refreshBlockTable();
  }

  function updateSelectBar_() {
    const $bar = document.getElementById("selectBar");
    if (!selectMode) { $bar.style.display = "none"; return; }
    $bar.style.display = "flex";
    document.getElementById("selectCount").textContent = `${selectedSlots.size}件選択中`;
  }

  async function applySelection_(mode) {
    const targets = [...selectedSlots.values()].filter((s) => (mode === "block" ? s.type === "open" : s.type === "blocked"));
    if (targets.length === 0) {
      showMsg("blockMsg", mode === "block" ? "空き（○）のマスを選んでください" : "ブロック中（×）のマスを選んでください", false);
      return;
    }
    for (const t of targets) {
      if (mode === "block") {
        const endTime = toHHMM(toMinutes(t.time) + config.slotIntervalMin);
        await apiPost("adminBlockTime", { date: t.date, startTime: t.time, endTime, reason: "管理者によるブロック" });
      } else {
        await apiPost("adminCancelReservation", { eventId: t.eventId });
      }
    }
    selectedSlots.clear();
    showMsg("blockMsg", "反映しました", true);
    refreshBlockTable();
  }

  // テーブル部分だけを再取得・再描画する（画面全体を「読み込み中」に戻さないため）
  async function refreshBlockTable() {
    const todK = todayKey();
    const pageDates = Array.from({ length: 7 }, (_, i) => addDays(todK, blockGridOffset + i));
    const timeLabels = allTimeLabels();

    document.getElementById("blockPrev").disabled = blockGridOffset <= 0;
    document.getElementById("blockNavLabel").textContent = `${pageDates[0]} 〜 ${pageDates[6]}`;

    const from = pageDates[0];
    const to = addDays(pageDates[pageDates.length - 1], 1);
    const res = await apiGet({ action: "getReservations", from, to });
    const events = res.success ? res.reservations : [];

    function statusAt(dateStr, label) {
      const [y, m, d] = dateStr.split("-").map(Number);
      const [h, mi] = label.split(":").map(Number);
      const slotStart = new Date(y, m - 1, d, h, mi).getTime();
      const slotEnd = slotStart + config.slotIntervalMin * 60 * 1000;
      const hit = events.find((ev) => {
        const es = new Date(ev.start).getTime();
        const ee = new Date(ev.end).getTime();
        return slotStart < ee && slotEnd > es;
      });
      return hit ? hit : null;
    }

    const headerCells = pageDates.map((d) => {
      const day = Number(d.split("-")[2]);
      const dow = dowOfDateStr(d);
      const closed = config.closedWeekdays.includes(dow);
      const dowCls = dow === 0 ? "sun" : dow === 6 ? "sat" : "";
      return `<th class="avail-th ${dowCls}"><span class="avail-th__d">${day}</span><span class="avail-th__w">${DOW_JA[dow]}</span>${closed ? '<span class="avail-th__closed">休</span>' : ""}</th>`;
    }).join("");

    const now = new Date();
    const bodyRows = timeLabels.map((label) => {
      const cells = pageDates.map((d) => {
        const closed = config.closedWeekdays.includes(dowOfDateStr(d));
        if (closed) return `<td class="avail-td avail-td--closed">－</td>`;
        const isPast = d === todK && toMinutes(label) <= now.getHours() * 60 + now.getMinutes();
        if (isPast) return `<td class="avail-td avail-td--closed">－</td>`;
        const hit = statusAt(d, label);
        const key = `${d}_${label}`;
        const selected = selectedSlots.has(key);
        if (!hit) {
          return `<td class="avail-td avail-td--open ${selected ? "avail-td--selected" : ""}" data-action="block" data-date="${d}" data-time="${label}">○</td>`;
        }
        if (hit.type === "blocked") {
          return `<td class="avail-td avail-td--blocked-cell ${selected ? "avail-td--selected" : ""}" data-action="unblock" data-id="${hit.eventId}" data-date="${d}" data-time="${label}" title="クリックで解除">×</td>`;
        }
        return `<td class="avail-td avail-td--reserved-cell" title="${hit.title}">予</td>`;
      }).join("");
      return `<tr><th class="avail-th-time">${label}</th>${cells}</tr>`;
    }).join("");

    document.getElementById("blockThead").innerHTML = `<tr><th class="avail-th-time"></th>${headerCells}</tr>`;
    document.getElementById("blockTbody").innerHTML = bodyRows;
    updateSelectBar_();

    document.querySelectorAll("[data-action='block']").forEach((cell) => {
      cell.addEventListener("click", async () => {
        const date = cell.dataset.date;
        const startTime = cell.dataset.time;
        if (selectMode) {
          const key = `${date}_${startTime}`;
          if (selectedSlots.has(key)) selectedSlots.delete(key);
          else selectedSlots.set(key, { type: "open", date, time: startTime });
          cell.classList.toggle("avail-td--selected");
          updateSelectBar_();
          return;
        }
        const endTime = toHHMM(toMinutes(startTime) + config.slotIntervalMin);
        cell.textContent = "…";
        cell.style.pointerEvents = "none";
        const r = await apiPost("adminBlockTime", { date, startTime, endTime, reason: "管理者によるブロック" });
        if (!r.success) showMsg("blockMsg", "失敗しました", false);
        refreshBlockTable();
      });
    });
    document.querySelectorAll("[data-action='unblock']").forEach((cell) => {
      cell.addEventListener("click", async () => {
        if (selectMode) {
          const date = cell.dataset.date;
          const time = cell.dataset.time;
          const key = `${date}_${time}`;
          if (selectedSlots.has(key)) selectedSlots.delete(key);
          else selectedSlots.set(key, { type: "blocked", date, time, eventId: cell.dataset.id });
          cell.classList.toggle("avail-td--selected");
          updateSelectBar_();
          return;
        }
        cell.textContent = "…";
        cell.style.pointerEvents = "none";
        const r = await apiPost("adminCancelReservation", { eventId: cell.dataset.id });
        if (!r.success) showMsg("blockMsg", "失敗しました", false);
        refreshBlockTable();
      });
    });
  }

  // ---------- メニュー管理 ----------
  function renderMenu() {
    $adminContainer.innerHTML = `
      <div class="admin-section-head"><h2>メニュー管理</h2>
        <button class="btn btn-primary btn-small" id="menuSave">保存する</button>
      </div>
      ${msgHtml("menuMsg")}
      <div id="menuCats"></div>
      <button class="admin-add-btn" id="addCat">＋ カテゴリを追加</button>
    `;
    renderMenuCats();
    document.getElementById("addCat").addEventListener("click", () => {
      config.menuCategories.push({ id: newId("cat"), name: "NEW", label: "新カテゴリ", items: [] });
      renderMenuCats();
    });
    document.getElementById("menuSave").addEventListener("click", saveMenu);
  }

  let collapsedCats = new Set();

  function renderMenuCats() {
    const $cats = document.getElementById("menuCats");
    $cats.innerHTML = config.menuCategories.map((cat, ci) => `
      <div class="admin-cat" data-ci="${ci}">
        <div class="admin-cat-head">
          <div class="admin-cat-head__num">${ci + 1}</div>
          <div class="admin-cat-head__fields">
            <div class="admin-item-field">
              <label>日本語表記</label>
              <input type="text" class="cat-ja" value="${cat.label}" placeholder="例: カット">
            </div>
            <div class="admin-item-field">
              <label>英語表記</label>
              <input type="text" class="cat-en" value="${cat.name}" placeholder="例: CUT">
            </div>
          </div>
          <span class="admin-cat-head__count">${cat.items.length}件</span>
          <button class="icon-btn cat-collapse" title="折りたたむ">${collapsedCats.has(ci) ? "▸" : "▾"}</button>
          <button class="icon-btn cat-del" title="カテゴリ削除">✕</button>
        </div>
        <div class="admin-item-rows" style="${collapsedCats.has(ci) ? "display:none;" : ""}">
          ${cat.items.map((item, ii) => `
            <div class="admin-item-row" data-ii="${ii}">
              <div class="admin-item-row__top">
                <div class="admin-item-field admin-item-field--name">
                  <label>メニュー名</label>
                  <input type="text" class="item-name" value="${item.name}" placeholder="例: カット（フリー指名）">
                </div>
                <button class="icon-btn item-del" title="このメニューを削除">✕</button>
              </div>
              <div class="admin-item-row__bottom">
                <div class="admin-item-field admin-item-field--num">
                  <label>所要時間</label>
                  <div class="admin-item-field__suffix">
                    <input type="number" class="item-duration" value="${item.durationMin}" min="5" step="5">
                    <span>分</span>
                  </div>
                </div>
                <div class="admin-item-field admin-item-field--num">
                  <label>料金</label>
                  <div class="admin-item-field__prefix">
                    <span>¥</span>
                    <input type="number" class="item-price" value="${item.price}" min="0" step="100">
                  </div>
                </div>
                <div class="admin-item-field admin-item-field--desc">
                  <label>説明（任意）</label>
                  <input type="text" class="item-desc" value="${item.desc || ""}" placeholder="例: 根元から毛先まで">
                </div>
              </div>
            </div>
          `).join("")}
        </div>
        <button class="admin-add-btn add-item" style="${collapsedCats.has(ci) ? "display:none;" : ""}">＋ メニューを追加</button>
      </div>
    `).join("");

    $cats.querySelectorAll(".admin-cat").forEach(($cat) => {
      const ci = Number($cat.dataset.ci);
      $cat.querySelector(".cat-collapse").addEventListener("click", () => {
        if (collapsedCats.has(ci)) collapsedCats.delete(ci);
        else collapsedCats.add(ci);
        renderMenuCats();
      });
      $cat.querySelector(".cat-del").addEventListener("click", () => {
        config.menuCategories.splice(ci, 1);
        renderMenuCats();
      });
      $cat.querySelector(".add-item").addEventListener("click", () => {
        config.menuCategories[ci].items.push({ id: newId("item"), name: "", durationMin: 60, price: 0, desc: "" });
        collapsedCats.delete(ci);
        renderMenuCats();
      });
      $cat.querySelectorAll(".item-del").forEach((btn) => {
        btn.addEventListener("click", () => {
          const ii = Number(btn.closest(".admin-item-row").dataset.ii);
          config.menuCategories[ci].items.splice(ii, 1);
          renderMenuCats();
        });
      });
    });
  }

  function saveMenu() {
    document.querySelectorAll("#menuCats .admin-cat").forEach(($cat) => {
      const ci = Number($cat.dataset.ci);
      config.menuCategories[ci].name = $cat.querySelector(".cat-en").value.trim();
      config.menuCategories[ci].label = $cat.querySelector(".cat-ja").value.trim();
      $cat.querySelectorAll(".admin-item-row").forEach(($row) => {
        const ii = Number($row.dataset.ii);
        const item = config.menuCategories[ci].items[ii];
        item.name = $row.querySelector(".item-name").value.trim();
        item.durationMin = Number($row.querySelector(".item-duration").value) || 30;
        item.price = Number($row.querySelector(".item-price").value) || 0;
        item.desc = $row.querySelector(".item-desc").value.trim();
      });
    });
    saveConfig("menuMsg");
  }

  // ---------- 店舗設定・パスワード変更 ----------
  function renderSettings() {
    if (!config.emailMessage) config.emailMessage = { intro: "", closing: "" };
    const em = config.emailMessage;
    $adminContainer.innerHTML = `
      <div class="admin-section-head"><h2>店舗設定</h2>
        <button class="btn btn-primary btn-small" id="settingsSave">保存する</button>
      </div>
      ${msgHtml("settingsMsg")}
      <div class="field"><label>店舗名</label><input type="text" id="s_name" value="${config.salonName}"></div>
      <div class="field"><label>キャッチコピー</label><input type="text" id="s_tagline" value="${config.tagline || ""}"></div>
      <div class="admin-row-2">
        <div class="field"><label>電話番号</label><input type="text" id="s_tel" value="${config.tel}"></div>
        <div class="field"><label>住所</label><input type="text" id="s_address" value="${config.address}"></div>
      </div>

      <hr style="border:none;border-top:1px solid var(--line);margin:26px 0;">
      <h2 style="font-size:1rem;">お客様への確認メールの文面</h2>
      <p style="color:var(--ink2);font-size:0.82rem;margin-top:-6px;">予約が入るとお客様に自動で届く確認メールの、あいさつ文と結びの文だけを自由に変更できます（予約内容や店舗情報は自動で入るので変更不要です）。</p>
      ${msgHtml("emailMsg")}
      <div class="field"><label>書き出しのあいさつ文</label><textarea id="e_intro" placeholder="例: ご予約ありがとうございます。以下の内容で承りました。">${em.intro || ""}</textarea></div>
      <div class="field"><label>結びの文</label><textarea id="e_closing" placeholder="例: 当日のご来店を心よりお待ちしております。">${em.closing || ""}</textarea></div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="emailSave">メール文面を保存する</button>
      </div>

      <hr style="border:none;border-top:1px solid var(--line);margin:26px 0;">
      <h2 style="font-size:1rem;">管理者パスワードの変更</h2>
      ${msgHtml("pwMsg")}
      <div class="admin-row-2">
        <div class="field"><label>新しいパスワード（6文字以上）</label><input type="password" id="newPw"></div>
        <div class="field"><label>確認用</label><input type="password" id="newPw2"></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="pwSave">パスワードを変更する</button>
      </div>
    `;
    document.getElementById("settingsSave").addEventListener("click", () => {
      config.salonName = document.getElementById("s_name").value.trim();
      config.tagline = document.getElementById("s_tagline").value.trim();
      config.tel = document.getElementById("s_tel").value.trim();
      config.address = document.getElementById("s_address").value.trim();
      saveConfig("settingsMsg").then(() => { $adminSalonName.textContent = `${config.salonName} 管理画面`; });
    });
    document.getElementById("emailSave").addEventListener("click", () => {
      config.emailMessage = {
        intro: document.getElementById("e_intro").value.trim(),
        closing: document.getElementById("e_closing").value.trim(),
      };
      saveConfig("emailMsg");
    });
    document.getElementById("pwSave").addEventListener("click", async () => {
      const p1 = document.getElementById("newPw").value;
      const p2 = document.getElementById("newPw2").value;
      if (p1.length < 6) return showMsg("pwMsg", "パスワードは6文字以上にしてください", false);
      if (p1 !== p2) return showMsg("pwMsg", "確認用パスワードが一致しません", false);
      const res = await apiPost("adminChangePassword", { newPassword: p1 });
      if (res.success) {
        adminPassword = p1;
        sessionStorage.setItem("salon_admin_password", adminPassword);
        showMsg("pwMsg", "パスワードを変更しました", true);
      } else {
        showMsg("pwMsg", res.error || "変更に失敗しました", false);
      }
    });
  }

  // ---------- 共通保存 ----------
  async function saveConfig(msgId) {
    const res = await apiPost("adminUpdateConfig", { config });
    if (res.success) showMsg(msgId, "保存しました", true);
    else showMsg(msgId, "保存に失敗しました", false);
    return res;
  }

  init();
})();
