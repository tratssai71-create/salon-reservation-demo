// ==============================================
// サロン予約システム 設定ファイル
// ここに入っている店名・メニュー・料金・スタッフはすべて仮の架空データです。
// クライアントの実データが決まり次第、この内容を書き換えてください。
// ==============================================

const SALON_CONFIG = {
  // 店舗情報
  salonName: "Mira hair salon",
  tagline: "髪と、暮らしをととのえる。",
  tel: "086-000-0000",
  address: "岡山県岡山市北区○○ 1-2-3",

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

  // メニュー一覧（カテゴリ別・すべて仮の架空プラン）
  menuCategories: [
    {
      id: "cut",
      name: "CUT",
      label: "カット",
      items: [
        { id: "cut_free", name: "カット（フリー指名）", durationMin: 60, price: 4400, desc: "スタイリスト指名なし" },
        { id: "cut_designate", name: "カット（指名）", durationMin: 60, price: 5500, desc: "スタイリストをご指名" },
        { id: "cut_kids", name: "キッズカット（〜12歳）", durationMin: 40, price: 3300, desc: "" },
      ],
    },
    {
      id: "color",
      name: "COLOR",
      label: "カラー",
      items: [
        { id: "color_full", name: "フルカラー", durationMin: 90, price: 8800, desc: "根元から毛先まで" },
        { id: "color_retouch", name: "リタッチカラー", durationMin: 60, price: 6600, desc: "根元の伸びた部分のみ" },
        { id: "color_highlight", name: "ハイライト／グラデーション", durationMin: 120, price: 13200, desc: "デザインカラー" },
      ],
    },
    {
      id: "perm",
      name: "PERM",
      label: "パーマ",
      items: [
        { id: "perm_digital", name: "デジタルパーマ", durationMin: 150, price: 14300, desc: "くせづけ長持ち" },
        { id: "perm_soft", name: "ゆるふわパーマ", durationMin: 120, price: 11000, desc: "コールドパーマ" },
      ],
    },
    {
      id: "treatment",
      name: "TREATMENT",
      label: "トリートメント",
      items: [
        { id: "treat_intensive", name: "集中トリートメント", durationMin: 40, price: 4400, desc: "" },
        { id: "treat_repair", name: "髪質改善トリートメント", durationMin: 90, price: 9900, desc: "酸熱トリートメント" },
      ],
    },
    {
      id: "spa",
      name: "HEAD SPA",
      label: "ヘッドスパ",
      items: [
        { id: "spa_relax", name: "リラックスヘッドスパ", durationMin: 30, price: 3300, desc: "" },
        { id: "spa_carbonic", name: "炭酸ヘッドスパ", durationMin: 45, price: 5500, desc: "毛穴クレンジング" },
      ],
    },
    {
      id: "set",
      name: "SET",
      label: "セット・その他",
      items: [
        { id: "set_kimono", name: "着付け＋セット", durationMin: 60, price: 8800, desc: "成人式・結婚式などに" },
      ],
    },
  ],

  // スタッフ一覧（"指名なし" は自動で先頭に追加されます）
  staff: [
    { id: "staff_a", name: "田中 美咲", role: "トップスタイリスト" },
    { id: "staff_b", name: "佐藤 亮", role: "スタイリスト" },
    { id: "staff_c", name: "鈴木 陽菜", role: "アシスタント" },
  ],
};
