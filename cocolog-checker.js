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

    // --- ▼ 3つの必須リンク（店舗情報一覧の公式、編集部コメントの公式、最後のGmap）のチェック ▼ ---
    const allLinks = mainArea.querySelectorAll('a[href]');
    let officialLinkCount = 0;
    let hasGmapSectionLink = false;

    const headings = mainArea.querySelectorAll('h2, h3, h4');
    let gmapHeading = null;
    for (let h of headings) {
      if (h.innerText.includes("Googleマップ")) {
        gmapHeading = h;
        break;
      }
    }

    if (gmapHeading) {
      let sibling = gmapHeading.nextElementSibling;
      while (sibling) {
        if (sibling.tagName === 'A' && (sibling.href.includes('maps.google.com') || sibling.href.includes('google.com/maps') || sibling.href.includes('goo.gl/maps'))) {
          hasGmapSectionLink = true;
          break;
        }
        if (sibling.querySelector && sibling.querySelector('a[href*="maps"], iframe[src*="maps"]')) {
          hasGmapSectionLink = true;
          break;
        }
        sibling = sibling.nextElementSibling;
      }
    }
    if (gI || gA) {
      hasGmapSectionLink = true;
    }

    allLinks.forEach(a => {
      const href = a.getAttribute('href');
      if (href && href.startsWith('http') && !href.includes('cocolog-nifty.com') && !href.includes('google.com') && !href.includes('maps.app.goo.gl')) {
        officialLinkCount++;
      }
    });

    if (officialLinkCount < 2) {
      m.push("公式サイトのリンク不足（店舗情報一覧または編集部コメントのリンクが未設置/テキスト化の可能性）");
    }
    if (!hasGmapSectionLink) {
      m.push("Googleマップセクションのリンク（または埋め込み）が未設置");
    }
    // --- ▲ ここまで ▲ ---

    // --- ▼ 所在地・アクセス周辺の地域・対応エリア＆番地判定 ▼ ---
    let accessText = pageText;
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

    let resHtml = "<h2>【ココログ 判定結果】</h2>";
    if (m.length === 0 && l.length === 0) {
      resHtml += "<p style='color:green; font-weight:bold;'>✅ 問題なし（全項目・リンク・エリア判定 正常）</p>";
    } else {
      resHtml += "<p style='color:red; font-weight:bold;'>❌ 要修正</p>";
      if (m.length > 0) {
        resHtml += "<p style='font-weight:bold; margin-top:10px;'>■ 不足要素:</p><ul style='margin:0; padding-left:20px;'>";
        m.forEach(item => resHtml += "<li>" + item + "</li>");
        resHtml += "</ul>";
      }
      if (l.length > 0) {
        resHtml += "<p style='font-weight:bold; margin-top:10px;'>■ 異常検出:</p><ul style='margin:0; padding-left:20px;'>";
        l.forEach(item => resHtml += "<li>" + item + "</li>");
        resHtml += "</ul>";
      }
    }

    // --- ▼ 画面スクロール可能なカスタムモーダルを表示 ▼ ---
    const oldModal = document.getElementById('cocolog-checker-modal');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cocolog-checker-modal';
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999999; display:flex; align-items:center; justify-content:center; font-family:sans-serif;";
    
    const box = document.createElement('div');
    box.style.cssText = "background:#fff; padding:20px 25px; border-radius:8px; width:90%; max-width:500px; max-height:80vh; overflow-y:auto; box-shadow:0 4px 15px rgba(0,0,0,0.3); font-size:14px; color:#333; line-height:1.5;";
    box.innerHTML = resHtml;

    const closeBtn = document.createElement('button');
    closeBtn.innerText = "閉じる";
    closeBtn.style.cssText = "display:block; width:100%; margin-top:20px; padding:10px; background:#007bff; color:#fff; border:none; border-radius:4px; font-size:16px; cursor:pointer; font-weight:bold;";
    closeBtn.onclick = function() { overlay.remove(); };

    box.appendChild(closeBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

  } catch(e) {
    alert("判定エラー: " + e.message);
  }
})();
