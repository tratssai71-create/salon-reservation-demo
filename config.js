// ==============================================
// サロン予約システム 設定ファイル
// クライアントの実データに合わせて、この内容を書き換えてください。
// ==============================================

const SALON_CONFIG = {
  // 店舗情報
  salonName: "SAMPLE HAIR SALON",
  tel: "000-0000-0000",
  address: "岡山県岡山市○○ 1-2-3",

  // GAS Web AppのデプロイURL。
  // 空文字のままだとフロント単体の「デモモード」で動作します（localStorageに予約を保存、実際のカレンダーには入りません）。
  // README.md の手順でGASをデプロイしたら、取得したURLをここに設定してください。
  API_URL: "",

  // 定休日（0=日曜〜6=土曜）。例: 月曜定休なら [1]
  closedWeekdays: [1],

  // 曜日別営業時間（分単位ではなく "HH:MM" で指定）
  businessHours: {
    default: { open: "10:00", close: "19:00" },
  },

  // 予約枠の刻み幅（分）
  slotIntervalMin: 30,

  // メニュー一覧
  menus: [
    { id: "cut", name: "カット", durationMin: 60, price: 4400 },
    { id: "color", name: "カラー", durationMin: 90, price: 7700 },
    { id: "perm", name: "パーマ", durationMin: 120, price: 9900 },
    { id: "cut_color", name: "カット＋カラー", durationMin: 150, price: 11000 },
    { id: "treatment", name: "トリートメント", durationMin: 40, price: 3300 },
  ],

  // スタッフ一覧（"指名なし" は自動で先頭に追加されます）
  staff: [
    { id: "staff_a", name: "田中" },
    { id: "staff_b", name: "佐藤" },
    { id: "staff_c", name: "鈴木" },
  ],
};
