(function(){
  try {
    let targetDoc = document;
    const iframes = document.querySelectorAll('iframe');
    for (let i = 0; i < iframes.length; i++) {
      try {
        if (iframes[i].contentDocument && iframes[i].contentDocument.querySelector('.entry-body, .entry-content, .entry, body')) {
          targetDoc = iframes[i].contentDocument;
          break;
        }
      } catch(e) {}
    }

    const r = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
    let m = [], l = [];

    const pageText = (targetDoc.body ? targetDoc.body.innerText : "").replace(/\s+/g, " ");
    const fullHtml = targetDoc.body ? targetDoc.body.innerHTML : "";
    const mainArea = targetDoc.querySelector('.entry-body,.entry-content,.entry,.entry-inner,#alpha-inner') || targetDoc.body;
    
    const gI = mainArea.querySelector('iframe[src*="maps.google.com"],iframe[src*="google.com/maps"]');
    const gA = mainArea.querySelector('a[href*="maps.google.com"],a[href*="google.com/maps"],a[href*="goo.gl/maps"]');

    function hP(u){
      if (!u) return false;
      return /[?&](q|query|cid)=/.test(u) || /!3d[-0-9.]*!4d[-0-9.]*/.test(u) || u.includes('maps.google.com/1');
    }

    let mU = "";
    if (gI) mU = gI.getAttribute('src') || "";
    else if (gA) mU = gA.getAttribute('href') || "";

    const txE = targetDoc.querySelector('.entry-header,.entry-title,h3.entry-header,h1,.entry-subject');
    const tx = txE ? txE.innerText.trim() : "";
    if (!tx) m.push("記事タイトル");

    const fI = mainArea.querySelector('img');
    if (!fI) m.push("画像設置（本文内に画像が見つかりません）");

    if (tx && (/(北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|京都|大阪|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄)/.test(tx) || /^.{1,5}[市区町村]/.test(tx))) {
      l.push("タイトル異常: 先頭が地名");
    }

    if (!pageText.includes("カテゴリ") || pageText.includes("カテゴリ：未分類") || pageText.includes("カテゴリー：未分類")){
      m.push("カテゴリ（設定なしまたは未分類）");
    }

    r.forEach(i => {
      if (i === "Googleマップ") {
        if (!pageText.includes("Googleマップ") && !gI && !gA) {
          m.push("Googleマップ");
        } else if ((gI || gA) && !hP(mU)) {
          m.push("Googleマップ（ピン未設定）");
        }
      } else {
        if (!pageText.includes(i)) m.push(i);
      }
    });

    if (/cit_[a-zA-Z0-9_-]{5,}/.test(fullHtml) || /data-cit/.test(fullHtml)) {
      l.push("AIコンテキストコード混入");
    }

    // --- ▼ 所在地・アクセス周辺の地域・対応エリア＆番地判定（柔軟化） ▼ ---
    let accessText = pageText;
    const headings = mainArea.querySelectorAll('h2, h3, h4');
    let accessHeading = null;
    for (let h of headings) {
      if (h.innerText.includes("所在地・アクセス")) {
        accessHeading = h;
        break;
      }
    }

    if (accessHeading) {
      let subTexts = [];
      let sibling = accessHeading.nextElementSibling;
      while (sibling) {
        if (['H2', 'H3', 'H4'].includes(sibling.tagName)) break;
        subTexts.push(sibling.innerText);
        sibling = sibling.nextElementSibling;
      }
      if (subTexts.length > 0) {
        accessText = subTexts.join("\n");
      }
    }

    const areaKeywords = ["エリア", "対象", "地域", "周辺", "近隣", "対応", "出張"];
    const hasAreaMention = areaKeywords.some(kw => accessText.includes(kw));

    if (hasAreaMention) {
      const banchiPattern = /\d+[\-−ー\d]+|\d+丁目|\d+番地?|\d+号/;
      if (banchiPattern.test(accessText)) {
        l.push("店舗あり(番地記載あり)のため『対応エリア・地域』等の記載不可");
      }
    }
    // --- ▲ ここまで ▲ ---

    let res = "【ココログ 判定結果】\n\n";
    if (m.length === 0 && l.length === 0) {
      res += "✅ 問題なし（全項目・エリア判定 正常）";
    } else {
      res += "❌ 要修正\n";
      if (m.length > 0) res += "\n■ 不足要素:\n・" + m.join("\n・") + "\n";
      if (l.length > 0) res += "\n■ 異常検出:\n・" + l.join("\n・") + "\n";
    }
    alert(res);

  } catch(e) {
    alert("判定エラー: " + e.message);
  }
})();
