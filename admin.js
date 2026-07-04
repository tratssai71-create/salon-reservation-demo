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
    else if (activeTab === "staff") renderStaff();
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

  async function renderBlock() {
    const todK = todayKey();
    const pageDates = Array.from({ length: 7 }, (_, i) => addDays(todK, blockGridOffset + i));
    const timeLabels = allTimeLabels();

    $adminContainer.innerHTML = `
      <div class="admin-section-head"><h2>時間をブロック</h2></div>
      <p style="color:var(--ink2);font-size:0.82rem;margin-top:-10px;">○をクリックするとその時間を予約不可にします。×（グレー）をクリックするとブロックを解除します。予約済み（オレンジ）はここからは操作できません。</p>
      ${msgHtml("blockMsg")}
      <div class="loading">読み込み中…</div>
    `;

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
        if (!hit) {
          return `<td class="avail-td avail-td--open" data-action="block" data-date="${d}" data-time="${label}">○</td>`;
        }
        if (hit.type === "blocked") {
          return `<td class="avail-td avail-td--blocked-cell" data-action="unblock" data-id="${hit.eventId}" title="クリックで解除">×</td>`;
        }
        return `<td class="avail-td avail-td--reserved-cell" title="${hit.title}">予</td>`;
      }).join("");
      return `<tr><th class="avail-th-time">${label}</th>${cells}</tr>`;
    }).join("");

    $adminContainer.innerHTML = `
      <div class="admin-section-head"><h2>時間をブロック</h2></div>
      <p style="color:var(--ink2);font-size:0.82rem;margin-top:-10px;">○をクリックするとその時間を予約不可にします。×（グレー）をクリックするとブロックを解除します。予約済み（オレンジ）はここからは操作できません。</p>
      ${msgHtml("blockMsg")}
      <div class="avail-nav">
        <button id="blockPrev" ${blockGridOffset <= 0 ? "disabled" : ""}>‹ 前の7日</button>
        <span class="avail-nav__label">${pageDates[0]} 〜 ${pageDates[6]}</span>
        <button id="blockNext">次の7日 ›</button>
      </div>
      <div class="avail-scroll">
        <table class="avail-table">
          <thead><tr><th class="avail-th-time"></th>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
      <p class="avail-legend">○ 空き（クリックでブロック） 　× ブロック中（クリックで解除） 　予 ご予約あり 　－ 定休日・受付終了</p>
    `;

    document.getElementById("blockPrev").addEventListener("click", () => {
      blockGridOffset = Math.max(0, blockGridOffset - 7);
      renderBlock();
    });
    document.getElementById("blockNext").addEventListener("click", () => {
      blockGridOffset += 7;
      renderBlock();
    });

    $adminContainer.querySelectorAll("[data-action='block']").forEach((cell) => {
      cell.addEventListener("click", async () => {
        const date = cell.dataset.date;
        const startTime = cell.dataset.time;
        const endTime = toHHMM(toMinutes(startTime) + config.slotIntervalMin);
        cell.textContent = "…";
        const r = await apiPost("adminBlockTime", { date, startTime, endTime, reason: "管理者によるブロック" });
        if (r.success) renderBlock();
        else { showMsg("blockMsg", "失敗しました", false); renderBlock(); }
      });
    });
    $adminContainer.querySelectorAll("[data-action='unblock']").forEach((cell) => {
      cell.addEventListener("click", async () => {
        cell.textContent = "…";
        const r = await apiPost("adminCancelReservation", { eventId: cell.dataset.id });
        if (r.success) renderBlock();
        else { showMsg("blockMsg", "失敗しました", false); renderBlock(); }
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

  function renderMenuCats() {
    const $cats = document.getElementById("menuCats");
    $cats.innerHTML = config.menuCategories.map((cat, ci) => `
      <div class="admin-cat" data-ci="${ci}">
        <div class="admin-cat-head">
          <input type="text" class="cat-en" value="${cat.name}" placeholder="英語表記 (例: CUT)">
          <input type="text" class="cat-ja" value="${cat.label}" placeholder="日本語表記 (例: カット)">
          <button class="icon-btn cat-del" title="カテゴリ削除">✕</button>
        </div>
        <div class="admin-item-rows">
          ${cat.items.map((item, ii) => `
            <div class="admin-item-row" data-ii="${ii}">
              <input type="text" class="item-name" value="${item.name}" placeholder="メニュー名">
              <input type="number" class="item-duration" value="${item.durationMin}" placeholder="分" min="5" step="5">
              <input type="number" class="item-price" value="${item.price}" placeholder="円" min="0" step="100">
              <input type="text" class="item-desc" value="${item.desc || ""}" placeholder="説明（任意）">
              <button class="icon-btn item-del" title="削除">✕</button>
            </div>
          `).join("")}
        </div>
        <button class="admin-add-btn add-item">＋ メニューを追加</button>
      </div>
    `).join("");

    $cats.querySelectorAll(".admin-cat").forEach(($cat) => {
      const ci = Number($cat.dataset.ci);
      $cat.querySelector(".cat-del").addEventListener("click", () => {
        config.menuCategories.splice(ci, 1);
        renderMenuCats();
      });
      $cat.querySelector(".add-item").addEventListener("click", () => {
        config.menuCategories[ci].items.push({ id: newId("item"), name: "", durationMin: 60, price: 0, desc: "" });
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

  // ---------- スタッフ管理 ----------
  function renderStaff() {
    $adminContainer.innerHTML = `
      <div class="admin-section-head"><h2>スタッフ管理</h2>
        <button class="btn btn-primary btn-small" id="staffSave">保存する</button>
      </div>
      ${msgHtml("staffMsg")}
      <div id="staffRows"></div>
      <button class="admin-add-btn" id="addStaff">＋ スタッフを追加</button>
    `;
    renderStaffRows();
    document.getElementById("addStaff").addEventListener("click", () => {
      config.staff.push({ id: newId("staff"), name: "", role: "" });
      renderStaffRows();
    });
    document.getElementById("staffSave").addEventListener("click", () => {
      document.querySelectorAll("#staffRows .admin-staff-row").forEach(($row) => {
        const si = Number($row.dataset.si);
        config.staff[si].name = $row.querySelector(".staff-name").value.trim();
        config.staff[si].role = $row.querySelector(".staff-role").value.trim();
      });
      saveConfig("staffMsg");
    });
  }

  function renderStaffRows() {
    const $rows = document.getElementById("staffRows");
    $rows.innerHTML = config.staff.map((s, si) => `
      <div class="admin-staff-row" data-si="${si}">
        <input type="text" class="staff-name" value="${s.name}" placeholder="氏名">
        <input type="text" class="staff-role" value="${s.role}" placeholder="役職（例: トップスタイリスト）">
        <button class="icon-btn staff-del" title="削除">✕</button>
      </div>
    `).join("");
    $rows.querySelectorAll(".staff-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        const si = Number(btn.closest(".admin-staff-row").dataset.si);
        config.staff.splice(si, 1);
        renderStaffRows();
      });
    });
  }

  // ---------- 店舗設定・パスワード変更 ----------
  function renderSettings() {
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
