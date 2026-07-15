// ==============================================
// サロン予約システム 設定ファイル
// ここに入っている店名・メニュー・料金・スタッフはすべて仮の架空データです。
// クライアントの実データが決まり次第、この内容を書き換えてください。
// ==============================================

const SALON_CONFIG = {
  // 店舗情報（racines.link の情報を反映）
  salonName: "Racines（ラシネス）",
  tagline: "内側から整う、本当の美しさへ。",
  tel: "090-1337-6945",
  address: "岡山県岡山市中区西川原246-1",

  // GAS Web AppのデプロイURL。
  // 空文字のままだとフロント単体の「デモモード」で動作します（localStorageに予約を保存、実際のカレンダーには入りません）。
  // README.md の手順でGASをデプロイしたら、取得したURLをここに設定してください。
  API_URL: "https://script.google.com/macros/s/AKfycbz5RZNniTmr7XmMPHDder5xLnX__gAYyJoaQ8HFq1s-Nci0_QDtKXFMrUUSks-olCzxWQ/exec",

  // 定休日（0=日曜〜6=土曜）。Racinesは「不定休」のため固定の定休日は設定せず、
  // 休みたい日はその都度、管理画面の「時間をブロック」でその日をまとめてブロックしてください。
  closedWeekdays: [],

  // 曜日別営業時間（分単位ではなく "HH:MM" で指定）
  businessHours: {
    default: { open: "10:00", close: "20:00" },
  },

  // 予約枠の刻み幅（分）
  slotIntervalMin: 30,

  // メニュー一覧（racines.link/menu/ の内容を反映。所要時間の記載がなかったメニューは仮の時間を入れているので、
  // 実際の時間に合わせて管理画面の「メニュー」タブから調整してください）
  menuCategories: [
    {
      id: "herb",
      name: "HERB TREATMENT",
      label: "ハーブトリートメント",
      items: [
        { id: "herb_first", name: "ハーブトリートメント（初回）", durationMin: 90, price: 15400, desc: "メディセル筋膜リリース＆ドライヘッドスパ付き" },
        { id: "herb_regular", name: "ハーブトリートメント（通常）", durationMin: 80, price: 21800, desc: "オプション：ヒト幹細胞培養液セラム+2,500円／エクソソーム導入+3,000円（当日ご相談ください）" },
      ],
    },
    {
      id: "spa",
      name: "DRY HEAD SPA",
      label: "ドライヘッドスパ",
      items: [
        { id: "spa_first", name: "ドライヘッドスパ60分（初回）", durationMin: 60, price: 6500, desc: "" },
        { id: "spa_utotori", name: "うっとりうたた寝", durationMin: 60, price: 7900, desc: "60分" },
        { id: "spa_sukkiri", name: "すっきり寝落ち", durationMin: 75, price: 9500, desc: "75分" },
        { id: "spa_special", name: "極上スペシャル", durationMin: 90, price: 10900, desc: "90分" },
      ],
    },
    {
      id: "medicel",
      name: "MEDICEL",
      label: "メディセル筋膜リリース",
      items: [
        { id: "medicel_full", name: "全身", durationMin: 90, price: 15000, desc: "" },
        { id: "medicel_back", name: "背面", durationMin: 60, price: 11000, desc: "" },
        { id: "medicel_half", name: "半身（上／下）", durationMin: 40, price: 8000, desc: "" },
        { id: "medicel_facial", name: "フェイシャルメディセル", durationMin: 30, price: 5000, desc: "" },
      ],
    },
  ],

  // 店主プロフィール（現在は予約フロー・管理画面どちらにも非表示。将来また表示する場合のために保持）
  owner: {
    name: "青山 愛子",
    role: "オーナー / エステティシャン",
    bio: "自身のニキビや肌トラブル、頭痛の経験から、ドライヘッドスパとエステだけでなく、インナーケアや生活習慣の改善まで含めたトータルケアを提供しています。",
    photoUrl: "",
  },
};
