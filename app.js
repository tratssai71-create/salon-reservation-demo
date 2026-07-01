// ==============================================
// サロン予約システム フロントエンドロジック
// SALON_CONFIG.API_URL が空の間は「デモモード」で動作します。
// ==============================================

(() => {
  const CFG = SALON_CONFIG;
  const STEP_LABELS = ["メニュー", "日付", "時間", "スタッフ", "情報", "確認"];
  const DOW_JA = ["日", "月", "火", "水", "木", "金", "土"];
  const isDemo = !CFG.API_URL;

  const state = {
    step: 1,
    menu: null,
    date: null, // "YYYY-MM-DD"
    time: null, // "HH:MM"
    staff: null, // {id,name} or {id:'', name:'指名なし'}
    customer: { name: "", tel: "", email: "", note: "" },
    calViewYear: null,
    calViewMonth: null, // 0-11
    slotsCache: {},
  };

  const $steps = document.getElementById("steps");
  const $container = document.getElementById("stepContainer");
  const $demoBanner = document.getElementById("demoBanner");
  const $salonName = document.getElementById("salonName");

  $salonName.textContent = CFG.salonName;
  if (isDemo) $demoBanner.style.display = "block";

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
      const menu = CFG.menus.find((m) => m.id === r.menuId);
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
    else if (state.step === 2) renderDateStep();
    else if (state.step === 3) renderTimeStep();
    else if (state.step === 4) renderStaffStep();
    else if (state.step === 5) renderInfoStep();
    else if (state.step === 6) renderConfirmStep();
    else if (state.step === 7) renderDoneStep();
  }

  function renderMenuStep() {
    $container.innerHTML = `
      <h2>メニューを選択してください</h2>
      <div class="option-list">
        ${CFG.menus.map((m) => `
          <div class="option-item ${state.menu?.id === m.id ? "selected" : ""}" data-id="${m.id}">
            <div class="option-item__main">
              <span class="option-item__name">${m.name}</span>
              <span class="option-item__meta">所要時間 約${m.durationMin}分</span>
            </div>
            <span class="option-item__price">${fmtPrice(m.price)}</span>
          </div>
        `).join("")}
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="next" ${state.menu ? "" : "disabled"}>次へ</button>
      </div>
    `;
    $container.querySelectorAll(".option-item").forEach((el) => {
      el.addEventListener("click", () => {
        state.menu = CFG.menus.find((m) => m.id === el.dataset.id);
        state.time = null;
        render();
      });
    });
    document.getElementById("next").addEventListener("click", () => {
      if (!state.menu) return;
      state.step = 2;
      render();
    });
  }

  function renderDateStep() {
    const now = new Date();
    if (state.calViewYear === null) {
      state.calViewYear = now.getFullYear();
      state.calViewMonth = now.getMonth();
    }
    const y = state.calViewYear, m = state.calViewMonth;
    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const todK = todayKey();
    const isCurrentMonth = y === now.getFullYear() && m === now.getMonth();

    let cells = "";
    for (let i = 0; i < firstDow; i++) cells += `<div class="cal-day empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = dateKey(y, m, d);
      const dow = new Date(y, m, d).getDay();
      const isPast = key < todK;
      const isClosed = CFG.closedWeekdays.includes(dow);
      const disabled = isPast || isClosed;
      const selected = state.date === key;
      cells += `<div class="cal-day ${disabled ? "disabled" : ""} ${selected ? "selected" : ""}" data-key="${key}" data-disabled="${disabled}">${d}</div>`;
    }

    $container.innerHTML = `
      <h2>日付を選択してください</h2>
      <div class="cal-nav">
        <button id="prevMonth" ${isCurrentMonth ? "disabled" : ""}>‹</button>
        <span class="cal-nav__label">${y}年${m + 1}月</span>
        <button id="nextMonth">›</button>
      </div>
      <div class="cal-grid">
        ${DOW_JA.map((d) => `<div class="cal-dow">${d}</div>`).join("")}
        ${cells}
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="back">戻る</button>
        <button class="btn btn-primary" id="next" ${state.date ? "" : "disabled"}>次へ</button>
      </div>
    `;

    document.getElementById("prevMonth").addEventListener("click", () => {
      state.calViewMonth -= 1;
      if (state.calViewMonth < 0) { state.calViewMonth = 11; state.calViewYear -= 1; }
      render();
    });
    document.getElementById("nextMonth").addEventListener("click", () => {
      state.calViewMonth += 1;
      if (state.calViewMonth > 11) { state.calViewMonth = 0; state.calViewYear += 1; }
      render();
    });
    $container.querySelectorAll(".cal-day[data-key]").forEach((el) => {
      if (el.dataset.disabled === "true") return;
      el.addEventListener("click", () => {
        state.date = el.dataset.key;
        state.time = null;
        render();
      });
    });
    document.getElementById("back").addEventListener("click", () => { state.step = 1; render(); });
    document.getElementById("next").addEventListener("click", () => {
      if (!state.date) return;
      state.step = 3;
      render();
    });
  }

  async function renderTimeStep() {
    $container.innerHTML = `
      <h2>時間を選択してください</h2>
      <p class="option-item__meta" style="margin:-10px 0 16px;">${fmtDateLabel(state.date)}・${state.menu.name}（約${state.menu.durationMin}分）</p>
      <div class="loading">空き時間を確認しています…</div>
    `;
    const slots = await fetchSlots(state.date, state.menu.durationMin);

    if (!slots.length) {
      $container.innerHTML = `
        <h2>時間を選択してください</h2>
        <p class="option-item__meta" style="margin:-10px 0 16px;">${fmtDateLabel(state.date)}・${state.menu.name}</p>
        <div class="empty-msg">この日は空き枠がありません。別の日付をお選びください。</div>
        <div class="btn-row">
          <button class="btn btn-ghost" id="back">戻る</button>
        </div>
      `;
      document.getElementById("back").addEventListener("click", () => { state.step = 2; render(); });
      return;
    }

    $container.innerHTML = `
      <h2>時間を選択してください</h2>
      <p class="option-item__meta" style="margin:-10px 0 16px;">${fmtDateLabel(state.date)}・${state.menu.name}（約${state.menu.durationMin}分）</p>
      <div class="slot-grid">
        ${slots.map((s) => `<div class="slot-btn ${state.time === s ? "selected" : ""}" data-time="${s}">${s}</div>`).join("")}
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="back">戻る</button>
        <button class="btn btn-primary" id="next" ${state.time ? "" : "disabled"}>次へ</button>
      </div>
    `;
    $container.querySelectorAll(".slot-btn").forEach((el) => {
      el.addEventListener("click", () => {
        state.time = el.dataset.time;
        render();
      });
    });
    document.getElementById("back").addEventListener("click", () => { state.step = 2; render(); });
    document.getElementById("next").addEventListener("click", () => {
      if (!state.time) return;
      state.step = 4;
      render();
    });
  }

  function renderStaffStep() {
    const options = [{ id: "", name: "指名なし" }, ...CFG.staff];
    $container.innerHTML = `
      <h2>スタッフを選択してください</h2>
      <div class="option-list">
        ${options.map((s) => `
          <div class="option-item ${state.staff?.id === s.id ? "selected" : ""}" data-id="${s.id}">
            <div class="option-item__main">
              <span class="option-item__name">${s.name}</span>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="back">戻る</button>
        <button class="btn btn-primary" id="next" ${state.staff ? "" : "disabled"}>次へ</button>
      </div>
    `;
    $container.querySelectorAll(".option-item").forEach((el) => {
      el.addEventListener("click", () => {
        state.staff = options.find((s) => s.id === el.dataset.id);
        render();
      });
    });
    document.getElementById("back").addEventListener("click", () => { state.step = 3; render(); });
    document.getElementById("next").addEventListener("click", () => {
      if (!state.staff) return;
      state.step = 5;
      render();
    });
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
    document.getElementById("back").addEventListener("click", () => { state.step = 4; render(); });
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
      state.step = 6;
      render();
    });
  }

  function renderConfirmStep() {
    const c = state.customer;
    $container.innerHTML = `
      <h2>ご予約内容の確認</h2>
      <ul class="confirm-list">
        <li><span>メニュー</span><span>${state.menu.name}（${fmtPrice(state.menu.price)}）</span></li>
        <li><span>日時</span><span>${fmtDateLabel(state.date)} ${state.time}〜</span></li>
        <li><span>担当</span><span>${state.staff.name}</span></li>
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
    document.getElementById("back").addEventListener("click", () => { state.step = 5; render(); });
    document.getElementById("confirm").addEventListener("click", async (e) => {
      e.target.disabled = true;
      e.target.textContent = "送信中…";
      const payload = {
        menuId: state.menu.id,
        menuName: state.menu.name,
        durationMin: state.menu.durationMin,
        price: state.menu.price,
        date: state.date,
        time: state.time,
        staffId: state.staff.id,
        staffName: state.staff.name,
        name: c.name,
        tel: c.tel,
        email: c.email,
        note: c.note,
      };
      try {
        const result = await submitReservation(payload);
        if (result.success) {
          state.reservationId = result.reservationId;
          state.step = 7;
          render();
        } else {
          alert("予約に失敗しました。時間を変えて再度お試しください。");
          state.step = 3;
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
        <li><span>担当</span><span>${state.staff.name}</span></li>
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
      state.staff = null;
      state.customer = { name: "", tel: "", email: "", note: "" };
      state.slotsCache = {};
      render();
    });
  }

  render();
})();
