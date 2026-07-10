// ==============================================
// サロン予約システム フロントエンドロジック
// SALON_CONFIG.API_URL が空の間は「デモモード」で動作します。
// ==============================================

(() => {
  const CFG = SALON_CONFIG;
  const STEP_LABELS = ["メニュー", "日時", "情報", "確認"];
  const DOW_JA = ["日", "月", "火", "水", "木", "金", "土"];
  const DAYS_PER_PAGE = 7;
  const isDemo = !CFG.API_URL;

  const state = {
    step: 1,
    menu: null,
    date: null, // "YYYY-MM-DD"
    time: null, // "HH:MM"
    customer: { name: "", tel: "", email: "", note: "" },
    gridStartOffset: 0, // 表示中の週の開始日（今日からの日数）
    slotsCache: {},
  };

  const $steps = document.getElementById("steps");
  const $container = document.getElementById("stepContainer");
  const $demoBanner = document.getElementById("demoBanner");
  const $salonName = document.getElementById("salonName");
  const $salonTagline = document.getElementById("salonTagline");
  const $salonMeta = document.getElementById("salonMeta");
  const $salonFooterMeta = document.getElementById("salonFooterMeta");

  // 本番モード（API_URL設定済み）では、店名・メニュー・スタッフ・営業時間などの
  // 「内容」はGAS側（管理画面で編集可能）から毎回取得し、config.js の値は上書きされる。
  async function loadRuntimeConfig() {
    if (isDemo) return;
    try {
      const res = await fetch(`${CFG.API_URL}?action=getConfig`);
      const json = await res.json();
      if (json.success) Object.assign(CFG, json.config);
    } catch (e) {
      console.error("設定の取得に失敗しました", e);
    }
  }

  function renderHeader() {
    document.title = `ご予約 | ${CFG.salonName}`;
    $salonName.textContent = CFG.salonName;
    if (CFG.tagline) $salonTagline.textContent = CFG.tagline;
    $salonMeta.textContent = `${CFG.address}　TEL ${CFG.tel}`;
    $salonFooterMeta.textContent = `${CFG.salonName}　${CFG.address}　TEL ${CFG.tel}`;
    if (isDemo) $demoBanner.style.display = "block";
  }
  renderHeader();

  function pad2(n) { return String(n).padStart(2, "0"); }
  function dateKey(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }
  function todayKey() {
    const t = new Date();
    return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
  }
  function fmtPrice(n) { return `¥${n.toLocaleString("ja-JP")}`; }
  function fmtDateLabel(key) {
    const [y, m, d] = key.split("-").map(Number);
    const dow = DOW_JA[new Date(y, m - 1, d).getDay()];
    return `${y}年${m}月${d}日（${dow}）`;
  }

  function allMenuItems() {
    return CFG.menuCategories.flatMap((cat) => cat.items.map((item) => ({ ...item, categoryLabel: cat.label })));
  }
  function findMenuItem(id) {
    return allMenuItems().find((m) => m.id === id) || null;
  }

  // ---------- ステップインジケーター ----------
  function renderSteps() {
    $steps.innerHTML = STEP_LABELS.map((label, i) => {
      const n = i + 1;
      const cls = n < state.step ? "done" : n === state.step ? "active" : "";
      return `<div class="step-dot ${cls}">${label}</div>`;
    }).join("");
  }

  // ---------- モックAPI（デモモード） ----------
  function loadDemoReservations() {
    try {
      return JSON.parse(localStorage.getItem("demo_reservations") || "[]");
    } catch (e) {
      return [];
    }
  }
  function saveDemoReservation(r) {
    const list = loadDemoReservations();
    list.push(r);
    localStorage.setItem("demo_reservations", JSON.stringify(list));
  }

  function getBusinessHours(dateKeyStr) {
    return CFG.businessHours[dateKeyStr] || CFG.businessHours.default;
  }

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }
  function toHHMM(mins) {
    return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
  }

  // 営業時間内の全タイムラベル（○×表の行）。休業日や個々の予約可否には関知しない。
  function allTimeLabels() {
    const hours = CFG.businessHours.default;
    const openMin = toMinutes(hours.open);
    const closeMin = toMinutes(hours.close);
    const labels = [];
    for (let t = openMin; t < closeMin; t += CFG.slotIntervalMin) labels.push(toHHMM(t));
    return labels;
  }

  function addDays(dateStr, days) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d + days);
    return dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
  }
  function dowOfDateStr(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
  }

  async function fetchSlots(dateStr, durationMin) {
    const cacheKey = `${dateStr}_${durationMin}`;
    if (state.slotsCache[cacheKey]) return state.slotsCache[cacheKey];

    let slots;
    if (isDemo) {
      slots = mockFetchSlots(dateStr, durationMin);
    } else {
      const url = `${CFG.API_URL}?action=getSlots&date=${encodeURIComponent(dateStr)}&durationMin=${durationMin}`;
      const res = await fetch(url);
      const json = await res.json();
      slots = json.slots || [];
    }
    state.slotsCache[cacheKey] = slots;
    return slots;
  }

  function mockFetchSlots(dateStr, durationMin) {
    const hours = getBusinessHours(dateStr);
    const openMin = toMinutes(hours.open);
    const closeMin = toMinutes(hours.close);
    const booked = loadDemoReservations().filter((r) => r.date === dateStr);
    const bookedRanges = booked.map((r) => {
      const menu = findMenuItem(r.menuId);
      const start = toMinutes(r.time);
      return [start, start + (menu ? menu.durationMin : 60)];
    });

    const slots = [];
    for (let t = openMin; t + durationMin <= closeMin; t += CFG.slotIntervalMin) {
      const end = t + durationMin;
      const overlaps = bookedRanges.some(([bs, be]) => t < be && end > bs);
      if (!overlaps) slots.push(toHHMM(t));
    }

    // 当日は現在時刻より前のスロットを除外
    const now = new Date();
    const todK = todayKey();
    if (dateStr === todK) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      return slots.filter((s) => toMinutes(s) > nowMin + 30);
    }
    return slots;
  }

  async function submitReservation(payload) {
    if (isDemo) {
      await new Promise((r) => setTimeout(r, 500));
      const id = `RSV-${payload.date.replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
      saveDemoReservation({ ...payload, reservationId: id });
      return { success: true, reservationId: id };
    }
    const res = await fetch(CFG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  // ---------- 各ステップ描画 ----------
  function render() {
    renderSteps();
    if (state.step === 1) renderMenuStep();
    else if (state.step === 2) renderDateTimeStep();
    else if (state.step === 3) renderInfoStep();
    else if (state.step === 4) renderConfirmStep();
    else if (state.step === 5) renderDoneStep();
  }

  function renderMenuStep() {
    $container.innerHTML = `
      <h2>メニューを選択してください</h2>
      ${CFG.menuCategories.map((cat) => `
        <div class="menu-category">
          <div class="menu-category__head">
            <span class="menu-category__en">${cat.name}</span>
            <span class="menu-category__ja">${cat.label}</span>
          </div>
          <div class="option-list">
            ${cat.items.map((m) => `
              <div class="option-item ${state.menu?.id === m.id ? "selected" : ""}" data-id="${m.id}">
                <div class="option-item__main">
                  <span class="option-item__name">${m.name}</span>
                  <span class="option-item__meta">所要時間 約${m.durationMin}分${m.desc ? " ・ " + m.desc : ""}</span>
                </div>
                <span class="option-item__price">${fmtPrice(m.price)}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("")}
      <div class="btn-row">
        <button class="btn btn-primary" id="next" ${state.menu ? "" : "disabled"}>次へ</button>
      </div>
    `;
    $container.querySelectorAll(".option-item").forEach((el) => {
      el.addEventListener("click", () => {
        state.menu = findMenuItem(el.dataset.id);
        state.date = null;
        state.time = null;
        state.gridStartOffset = 0;
        render();
      });
    });
    document.getElementById("next").addEventListener("click", () => {
      if (!state.menu) return;
      state.step = 2;
      render();
    });
  }

  async function renderDateTimeStep() {
    const todK = todayKey();
    const pageDates = Array.from({ length: DAYS_PER_PAGE }, (_, i) => addDays(todK, state.gridStartOffset + i));
    const timeLabels = allTimeLabels();

    $container.innerHTML = `
      <h2>日時を選択してください</h2>
      <p class="option-item__meta" style="margin:-10px 0 16px;">${state.menu.categoryLabel} - ${state.menu.name}（約${state.menu.durationMin}分）</p>
      <div class="loading">空き状況を確認しています…</div>
    `;

    const slotsByDate = {};
    await Promise.all(
      pageDates.map(async (d) => {
        slotsByDate[d] = CFG.closedWeekdays.includes(dowOfDateStr(d)) ? [] : await fetchSlots(d, state.menu.durationMin);
      })
    );

    const headerCells = pageDates.map((d) => {
      const day = Number(d.split("-")[2]);
      const dow = dowOfDateStr(d);
      const closed = CFG.closedWeekdays.includes(dow);
      const dowCls = dow === 0 ? "sun" : dow === 6 ? "sat" : "";
      return `<th class="avail-th ${dowCls}"><span class="avail-th__d">${day}</span><span class="avail-th__w">${DOW_JA[dow]}</span>${closed ? '<span class="avail-th__closed">休</span>' : ""}</th>`;
    }).join("");

    const bodyRows = timeLabels.map((label) => {
      const cells = pageDates.map((d) => {
        const available = slotsByDate[d].includes(label);
        if (available) {
          return `<td class="avail-td avail-td--open" data-date="${d}" data-time="${label}">○</td>`;
        }
        return `<td class="avail-td avail-td--closed">×</td>`;
      }).join("");
      return `<tr><th class="avail-th-time">${label}</th>${cells}</tr>`;
    }).join("");

    $container.innerHTML = `
      <h2>日時を選択してください</h2>
      <p class="option-item__meta" style="margin:-10px 0 16px;">${state.menu.categoryLabel} - ${state.menu.name}（約${state.menu.durationMin}分）</p>
      <div class="avail-nav">
        <button id="prevWeek" ${state.gridStartOffset <= 0 ? "disabled" : ""}>‹ 前の7日</button>
        <span class="avail-nav__label">${fmtDateLabel(pageDates[0]).replace(/（.+）/, "")} 〜 ${fmtDateLabel(pageDates[pageDates.length - 1]).replace(/（.+）/, "")}</span>
        <button id="nextWeek">次の7日 ›</button>
      </div>
      <div class="avail-scroll">
        <table class="avail-table">
          <thead><tr><th class="avail-th-time"></th>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
      <p class="avail-legend">○ … ご予約可能　× … 予約不可・受付終了</p>
      <div class="btn-row">
        <button class="btn btn-ghost" id="back">戻る</button>
      </div>
    `;

    document.getElementById("prevWeek").addEventListener("click", () => {
      state.gridStartOffset = Math.max(0, state.gridStartOffset - DAYS_PER_PAGE);
      render();
    });
    document.getElementById("nextWeek").addEventListener("click", () => {
      state.gridStartOffset += DAYS_PER_PAGE;
      render();
    });
    $container.querySelectorAll(".avail-td--open").forEach((el) => {
      el.addEventListener("click", () => {
        state.date = el.dataset.date;
        state.time = el.dataset.time;
        state.step = 3;
        render();
      });
    });
    document.getElementById("back").addEventListener("click", () => { state.step = 1; render(); });
  }

  function renderInfoStep() {
    const c = state.customer;
    $container.innerHTML = `
      <h2>お客様情報を入力してください</h2>
      <div class="field" id="f-name">
        <label>お名前 <span style="color:var(--danger)">*</span></label>
        <input type="text" id="name" value="${c.name}" placeholder="山田 太郎">
        <div class="field-error">お名前を入力してください</div>
      </div>
      <div class="field" id="f-tel">
        <label>電話番号 <span style="color:var(--danger)">*</span></label>
        <input type="tel" id="tel" value="${c.tel}" placeholder="09012345678">
        <div class="field-error">正しい電話番号を入力してください</div>
      </div>
      <div class="field" id="f-email">
        <label>メールアドレス <span style="color:var(--danger)">*</span></label>
        <input type="email" id="email" value="${c.email}" placeholder="example@mail.com">
        <div class="field-error">正しいメールアドレスを入力してください</div>
      </div>
      <div class="field">
        <label>ご要望・備考（任意）</label>
        <textarea id="note" placeholder="ご要望があればご記入ください">${c.note}</textarea>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="back">戻る</button>
        <button class="btn btn-primary" id="next">確認画面へ</button>
      </div>
    `;
    document.getElementById("back").addEventListener("click", () => { state.step = 2; render(); });
    document.getElementById("next").addEventListener("click", () => {
      const name = document.getElementById("name").value.trim();
      const tel = document.getElementById("tel").value.trim();
      const email = document.getElementById("email").value.trim();
      const note = document.getElementById("note").value.trim();

      const telOk = /^[0-9\-+()]{9,15}$/.test(tel);
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      document.getElementById("f-name").classList.toggle("invalid", !name);
      document.getElementById("f-tel").classList.toggle("invalid", !telOk);
      document.getElementById("f-email").classList.toggle("invalid", !emailOk);

      if (!name || !telOk || !emailOk) return;

      state.customer = { name, tel, email, note };
      state.step = 4;
      render();
    });
  }

  function renderConfirmStep() {
    const c = state.customer;
    $container.innerHTML = `
      <h2>ご予約内容の確認</h2>
      <ul class="confirm-list">
        <li><span>メニュー</span><span>${state.menu.categoryLabel} - ${state.menu.name}（${fmtPrice(state.menu.price)}）</span></li>
        <li><span>日時</span><span>${fmtDateLabel(state.date)} ${state.time}〜</span></li>
        <li><span>お名前</span><span>${c.name}</span></li>
        <li><span>電話番号</span><span>${c.tel}</span></li>
        <li><span>メール</span><span>${c.email}</span></li>
        ${c.note ? `<li><span>備考</span><span>${c.note}</span></li>` : ""}
      </ul>
      <div class="notice">この内容で予約を確定すると、店舗のGoogleカレンダーに自動で登録され、ご入力いただいたメールアドレス宛に確認メールが送信されます。</div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="back">戻る</button>
        <button class="btn btn-primary" id="confirm">予約を確定する</button>
      </div>
    `;
    document.getElementById("back").addEventListener("click", () => { state.step = 3; render(); });
    document.getElementById("confirm").addEventListener("click", async (e) => {
      e.target.disabled = true;
      e.target.textContent = "送信中…";
      const payload = {
        action: "createReservation",
        menuId: state.menu.id,
        menuName: state.menu.name,
        durationMin: state.menu.durationMin,
        price: state.menu.price,
        date: state.date,
        time: state.time,
        staffName: CFG.owner ? CFG.owner.name : "",
        name: c.name,
        tel: c.tel,
        email: c.email,
        note: c.note,
      };
      try {
        const result = await submitReservation(payload);
        if (result.success) {
          state.reservationId = result.reservationId;
          state.step = 5;
          render();
        } else {
          alert("予約に失敗しました。時間を変えて再度お試しください。");
          state.step = 2;
          state.slotsCache = {};
          render();
        }
      } catch (err) {
        alert("通信エラーが発生しました。しばらくしてから再度お試しください。");
        e.target.disabled = false;
        e.target.textContent = "予約を確定する";
      }
    });
  }

  function renderDoneStep() {
    $container.innerHTML = `
      <div class="done-icon">✓</div>
      <p class="done-title">ご予約を承りました</p>
      <p class="done-sub">${isDemo ? "（デモモードのため実際のカレンダーには追加されていません）" : "Googleカレンダーに自動登録されました。確認メールをご確認ください。"}</p>
      <div class="reservation-id">${state.reservationId}</div>
      <ul class="confirm-list">
        <li><span>メニュー</span><span>${state.menu.name}</span></li>
        <li><span>日時</span><span>${fmtDateLabel(state.date)} ${state.time}〜</span></li>
      </ul>
      <div class="btn-row">
        <button class="btn btn-primary" id="restart">新しく予約する</button>
      </div>
    `;
    document.getElementById("restart").addEventListener("click", () => {
      state.step = 1;
      state.menu = null;
      state.date = null;
      state.time = null;
      state.customer = { name: "", tel: "", email: "", note: "" };
      state.slotsCache = {};
      state.gridStartOffset = 0;
      render();
    });
  }

  (async () => {
    await loadRuntimeConfig();
    renderHeader();
    render();
  })();
})();
