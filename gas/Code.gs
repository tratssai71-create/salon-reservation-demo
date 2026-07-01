/**
 * サロン予約システム バックエンド（Google Apps Script）
 *
 * デプロイ手順は README.md を参照してください。
 * CONFIG は必ずご自身の環境に合わせて書き換えてください。
 * フロント側の config.js とメニュー/スタッフ/営業時間は同じ内容にしてください。
 */

const CONFIG = {
  // 予約を登録するGoogleカレンダーのID。
  // 自分のメインカレンダーでよければ "primary"。
  // 別カレンダーを使う場合はカレンダー設定画面の「カレンダーの統合」からIDをコピーする。
  CALENDAR_ID: "primary",

  // 予約が入った際に運営者へ通知メールを送る宛先（不要なら空文字に）
  NOTIFY_EMAIL: "",

  // 予約ログを残すスプレッドシートID（不要なら空文字にすると記録をスキップ）
  SPREADSHEET_ID: "",

  closedWeekdays: [1], // 0=日曜〜6=土曜

  businessHours: {
    default: { open: "10:00", close: "19:00" },
  },

  slotIntervalMin: 30,

  // フロント側 config.js の menuCategories と同じ内容にする（すべて仮の架空プラン）
  menus: {
    cut_free: { name: "カット（フリー指名）", durationMin: 60, price: 4400 },
    cut_designate: { name: "カット（指名）", durationMin: 60, price: 5500 },
    cut_kids: { name: "キッズカット（〜12歳）", durationMin: 40, price: 3300 },
    color_full: { name: "フルカラー", durationMin: 90, price: 8800 },
    color_retouch: { name: "リタッチカラー", durationMin: 60, price: 6600 },
    color_highlight: { name: "ハイライト／グラデーション", durationMin: 120, price: 13200 },
    perm_digital: { name: "デジタルパーマ", durationMin: 150, price: 14300 },
    perm_soft: { name: "ゆるふわパーマ", durationMin: 120, price: 11000 },
    treat_intensive: { name: "集中トリートメント", durationMin: 40, price: 4400 },
    treat_repair: { name: "髪質改善トリートメント", durationMin: 90, price: 9900 },
    spa_relax: { name: "リラックスヘッドスパ", durationMin: 30, price: 3300 },
    spa_carbonic: { name: "炭酸ヘッドスパ", durationMin: 45, price: 5500 },
    set_kimono: { name: "着付け＋セット", durationMin: 60, price: 8800 },
  },
};

function doGet(e) {
  const action = e.parameter.action;
  if (action === "getSlots") {
    return jsonOutput(handleGetSlots(e.parameter.date, Number(e.parameter.durationMin) || 60));
  }
  return jsonOutput({ error: "unknown action" });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    return jsonOutput(handleCreateReservation(payload));
  } catch (err) {
    return jsonOutput({ success: false, error: String(err) });
  }
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// ---------- 空き時間計算 ----------

function getBusinessHours_(dateStr) {
  return CONFIG.businessHours[dateStr] || CONFIG.businessHours.default;
}

function toMinutes_(hhmm) {
  const parts = hhmm.split(":").map(Number);
  return parts[0] * 60 + parts[1];
}

function toHHMM_(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return Utilities.formatString("%02d:%02d", h, m);
}

function handleGetSlots(dateStr, durationMin) {
  if (!dateStr) return { slots: [] };

  const parts = dateStr.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const dow = date.getDay();
  if (CONFIG.closedWeekdays.indexOf(dow) !== -1) return { slots: [] };

  const hours = getBusinessHours_(dateStr);
  const openMin = toMinutes_(hours.open);
  const closeMin = toMinutes_(hours.close);

  const dayStart = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
  const dayEnd = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);
  const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  const events = calendar.getEvents(dayStart, dayEnd);
  const busyRanges = events.map((ev) => [ev.getStartTime().getTime(), ev.getEndTime().getTime()]);

  const slots = [];
  const now = new Date();
  const isToday =
    now.getFullYear() === parts[0] && now.getMonth() === parts[1] - 1 && now.getDate() === parts[2];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (let t = openMin; t + durationMin <= closeMin; t += CONFIG.slotIntervalMin) {
    if (isToday && t <= nowMin + 30) continue;

    const slotStart = new Date(parts[0], parts[1] - 1, parts[2], Math.floor(t / 60), t % 60, 0).getTime();
    const slotEnd = slotStart + durationMin * 60 * 1000;
    const overlaps = busyRanges.some(([bs, be]) => slotStart < be && slotEnd > bs);
    if (!overlaps) slots.push(toHHMM_(t));
  }

  return { slots: slots };
}

// ---------- 予約作成 ----------

function handleCreateReservation(payload) {
  const required = ["menuId", "date", "time", "name", "tel", "email"];
  for (const key of required) {
    if (!payload[key]) return { success: false, error: `missing field: ${key}` };
  }

  const menu = CONFIG.menus[payload.menuId];
  if (!menu) return { success: false, error: "invalid menuId" };

  const parts = payload.date.split("-").map(Number);
  const timeParts = payload.time.split(":").map(Number);
  const start = new Date(parts[0], parts[1] - 1, parts[2], timeParts[0], timeParts[1], 0);
  const end = new Date(start.getTime() + menu.durationMin * 60 * 1000);

  // 直前の二重予約チェック
  const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  const conflicting = calendar.getEvents(start, end);
  if (conflicting.length > 0) {
    return { success: false, error: "slot_unavailable" };
  }

  const title = `【予約】${menu.name} / ${payload.name}様`;
  const description = [
    `メニュー: ${menu.name}（${fmtPrice_(menu.price)}）`,
    `お客様名: ${payload.name}`,
    `電話番号: ${payload.tel}`,
    `メール: ${payload.email}`,
    payload.staffName ? `担当: ${payload.staffName}` : "",
    payload.note ? `備考: ${payload.note}` : "",
  ].filter(Boolean).join("\n");

  const eventOptions = {};
  if (payload.email) eventOptions.guests = payload.email;

  const event = calendar.createEvent(title, start, end, eventOptions);

  const reservationId = `RSV-${payload.date.replace(/-/g, "")}-${Utilities.formatString(
    "%04d",
    Math.floor(Math.random() * 10000)
  )}`;
  event.setDescription(`予約ID: ${reservationId}\n\n${description}`);

  sendConfirmationEmail_(payload, menu, reservationId);
  if (CONFIG.NOTIFY_EMAIL) sendOwnerNotification_(payload, menu, reservationId);
  if (CONFIG.SPREADSHEET_ID) logReservation_(payload, menu, reservationId);

  return { success: true, reservationId: reservationId };
}

function fmtPrice_(n) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function sendConfirmationEmail_(payload, menu, reservationId) {
  const subject = `【ご予約確認】${payload.date} ${payload.time}〜`;
  const body = [
    `${payload.name} 様`,
    "",
    "ご予約ありがとうございます。以下の内容で承りました。",
    "",
    `予約ID: ${reservationId}`,
    `メニュー: ${menu.name}（${fmtPrice_(menu.price)}）`,
    `日時: ${payload.date} ${payload.time}〜`,
    payload.staffName ? `担当: ${payload.staffName}` : "",
    payload.note ? `備考: ${payload.note}` : "",
    "",
    "当日のご来店をお待ちしております。",
  ].filter(Boolean).join("\n");
  MailApp.sendEmail(payload.email, subject, body);
}

function sendOwnerNotification_(payload, menu, reservationId) {
  const subject = `【新規予約】${payload.date} ${payload.time} / ${payload.name}様`;
  const body = [
    `予約ID: ${reservationId}`,
    `メニュー: ${menu.name}`,
    `日時: ${payload.date} ${payload.time}〜`,
    `お客様: ${payload.name} / ${payload.tel} / ${payload.email}`,
    payload.staffName ? `担当: ${payload.staffName}` : "",
    payload.note ? `備考: ${payload.note}` : "",
  ].filter(Boolean).join("\n");
  MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, subject, body);
}

function logReservation_(payload, menu, reservationId) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("予約ログ") || ss.insertSheet("予約ログ");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "予約ID", "登録日時", "予約日", "時間", "メニュー", "担当", "氏名", "電話", "メール", "備考",
    ]);
  }
  sheet.appendRow([
    reservationId,
    new Date(),
    payload.date,
    payload.time,
    menu.name,
    payload.staffName || "",
    payload.name,
    payload.tel,
    payload.email,
    payload.note || "",
  ]);
}
