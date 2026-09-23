(function(){
  try {
    const targetDoc = document;
    const r = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
    let m = [], l = [];

    const pageText = (targetDoc.body ? targetDoc.body.innerText : "").replace(/\s+/g, " ");
    const fullHtml = targetDoc.body ? targetDoc.body.innerHTML : "";
    const mainArea = targetDoc.querySelector('.entry-body,.entry-content,.entry,.entry-inner,#alpha-inner') || targetDoc.body;
    
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

    const gI = mainArea.querySelector('iframe[src*="maps.google.com"],iframe[src*="google.com/maps"]');
    const gA = mainArea.querySelector('a[href*="maps.google.com"],a[href*="google.com/maps"],a[href*="goo.gl/maps"],a[href*="maps.app.goo.gl"]');

    function hP(u){
      if (!u) return false;
      return /[?&](q|query|cid)=/.test(u) || /!3d[-0-9.]*!4d[-0-9.]*/.test(u) || u.includes('maps.google.com/1') || u.includes('maps.app.goo.gl');
    }

    let mU = "";
    if (gI) mU = gI.getAttribute('src') || "";
    else if (gA) mU = gA.getAttribute('href') || "";

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

    // --- ▼ 必須リンク・URLの強力な抽出処理 ▼ ---
    const allLinks = mainArea.querySelectorAll('a[href]');
    let detectedUrls = [];
    let officialLinkCount = 0;
    let hasGmapLink = (gI || gA);

    allLinks.forEach(a => {
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('http')) return;

      // Googleマップ系リンクの判定
      if (href.includes('maps.google.com') || href.includes('google.com/maps') || href.includes('goo.gl/maps') || href.includes('maps.app.goo.gl')) {
        hasGmapLink = true;
        detectedUrls.push({name: "Googleマップリンク", url: href});
      }
      // ココログ自身やGoogle検索等を除外した「外部サイト（公式サイトなど）」の判定
      else if (!href.includes('cocolog-nifty.com') && !href.includes('google.com')) {
        officialLinkCount++;
        detectedUrls.push({name: "公式サイト/外部リンク (" + officialLinkCount + "つ目)", url: href});
      }
    });

    if (gI) {
      detectedUrls.push({name: "Googleマップ(埋め込み)", url: gI.src});
    }

    if (officialLinkCount < 2) {
      m.push("公式サイトのリンク不足（店舗情報一覧または編集部コメントのリンクが未設置/テキスト化の可能性）");
    }
    if (!hasGmapLink) {
      m.push("Googleマップセクションのリンク（または埋め込み）が未設置");
    }
    // --- ▲ ここまで ▲ ---

    // --- ▼ 所在地・アクセス周辺の地域・対応エリア＆番地判定 ▼ ---
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

    // --- ▼ 追加：設備セクションの禁止ワードチェック ▼ ---
    let equipmentText = "";
    let equipmentHeading = null;
    for (let h of headings) {
      if (h.innerText.includes("設備")) {
        equipmentHeading = h;
        break;
      }
    }

    if (equipmentHeading) {
      let subTexts = [];
      let sibling = equipmentHeading.nextElementSibling;
      while (sibling) {
        if (['H2', 'H3', 'H4'].includes(sibling.tagName)) break;
        subTexts.push(sibling.innerText);
        sibling = sibling.nextElementSibling;
      }
      if (subTexts.length > 0) {
        equipmentText = subTexts.join("\n");
      }
    }

    const ngEquipmentKeywords = ["スタッフ", "対応", "マンツーマン", "施術", "空間", "特徴"];
    const foundNgKeywords = ngEquipmentKeywords.filter(kw => equipmentText.includes(kw));
    if (foundNgKeywords.length > 0 && !equipmentText.includes("公開情報では確認できませんでした")) {
      l.push("設備セクションにサービスや特徴の文言混入 (検出ワード: " + foundNgKeywords.join(", ") + ")");
    }
    // --- ▲ ここまで追加 ▲ ---

    // --- ▼ HTML出力・リンク確認ボタン付きUIの生成 ▼ ---
    let resHtml = "<h2 style='margin-top:0; font-size:18px;'>【ココログ 判定結果】</h2>";
    if (m.length === 0 && l.length === 0) {
      resHtml += "<p style='color:green; font-weight:bold;'>✅ 問題なし（全項目・リンク・エリア・設備判定 正常）</p>";
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

    if (detectedUrls.length > 0) {
      resHtml += "<hr style='margin:15px 0; border:0; border-top:1px solid #ddd;'>";
      resHtml += "<p style='font-weight:bold; margin-bottom:5px;'>🔗 検出されたリンクの生存確認（クリックで別タブオープン）:</p>";
      resHtml += "<ul style='margin:0; padding-left:20px;'>";
      const uniqueUrls = Array.from(new Set(detectedUrls.map(d => d.url)))
        .map(url => detectedUrls.find(d => d.url === url));
      
      uniqueUrls.forEach(d => {
        resHtml += `<li style='margin-bottom:6px;'><a href='${d.url}' target='_blank' style='color:#007bff; text-decoration:underline; font-weight:bold;'>[${d.name}]<br><span style='font-size:11px; color:#555;'>${d.url}</span></a></li>`;
      });
      resHtml += "</ul>";
    }

    const oldModal = document.getElementById('cocolog-checker-modal');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cocolog-checker-modal';
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999999; display:flex; align-items:center; justify-content:center; font-family:sans-serif;";
    
    const box = document.createElement('div');
    box.style.cssText = "background:#fff; padding:20px 25px; border-radius:8px; width:90%; max-width:550px; max-height:85vh; overflow-y:auto; box-shadow:0 4px 15px rgba(0,0,0,0.3); font-size:13px; color:#333; line-height:1.5; word-break:break-all;";
    box.innerHTML = resHtml;

    const closeBtn = document.createElement('button');
    closeBtn.innerText = "閉じる";
    closeBtn.style.cssText = "display:block; width:100%; margin-top:20px; padding:10px; background:#007bff; color:#fff; border:none; border-radius:4px; font-size:15px; cursor:pointer; font-weight:bold;";
    closeBtn.onclick = function() { overlay.remove(); };

    box.appendChild(closeBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

  } catch(e) {
    alert("判定エラー: " + e.message);
  }
})();
