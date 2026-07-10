// ==============================================
// スタッフ紹介ページ ロジック
// 一人サロンのため、予約時のスタッフ選択の代わりにこのページでプロフィールを紹介します。
// ==============================================

(() => {
  const CFG = SALON_CONFIG;
  const isDemo = !CFG.API_URL;

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

  function render() {
    document.title = `スタッフ紹介 | ${CFG.salonName}`;
    document.getElementById("salonName").textContent = CFG.salonName;
    if (CFG.tagline) document.getElementById("salonTagline").textContent = CFG.tagline;
    document.getElementById("salonMeta").textContent = `${CFG.address}　TEL ${CFG.tel}`;
    document.getElementById("salonFooterMeta").textContent = `${CFG.salonName}　${CFG.address}　TEL ${CFG.tel}`;

    const o = CFG.owner || {};
    if (o.photoUrl) {
      document.getElementById("staffPhoto").innerHTML = `<img src="${o.photoUrl}" alt="${o.name || ""}">`;
    }
    document.getElementById("staffName").textContent = o.name || "";
    document.getElementById("staffRole").textContent = o.role || "";
    document.getElementById("staffBio").textContent = o.bio || "";
  }

  (async () => {
    await loadRuntimeConfig();
    render();
  })();
})();
