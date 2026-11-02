(function(){
  // 1. 既存のモーダルがあれば削除
  const oldModal = document.getElementById('cocolog-checker-modal');
  if (oldModal) oldModal.remove();

  // 2. モーダルUIの構築
  const overlay = document.createElement('div');
  overlay.id = 'cocolog-checker-modal';
  overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999999; display:flex; align-items:center; justify-content:center; font-family:sans-serif;";

  const box = document.createElement('div');
  box.style.cssText = "background:#fff; padding:20px 25px; border-radius:8px; width:90%; max-width:650px; max-height:85vh; overflow-y:auto; box-shadow:0 4px 20px rgba(0,0,0,0.3); font-size:13px; color:#333; line-height:1.5;";
  
  box.innerHTML = `
    <h2 style="margin-top:0; font-size:18px;">【ココログ 一括DOM判定チェッカー】</h2>
    <p style="margin-bottom:8px; font-weight:bold; color:#555;">チェックしたい記事のURLを改行区切りで貼り付けてください（20〜50件対応）:</p>
    <textarea id="cocolog-url-input" rows="8" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px; font-family:monospace; font-size:12px; box-sizing:border-box;" placeholder="https://xxx.cocolog-nifty.com/blog/2026/01/post-xxx.html&#10;https://xxx.cocolog-nifty.com/blog/2026/01/post-yyy.html"></textarea>
    
    <button id="run-batch-btn" style="margin-top:10px; width:100%; padding:10px; background:#28a745; color:#fff; border:none; border-radius:4px; font-size:15px; font-weight:bold; cursor:pointer;">一括判定を実行する</button>

    <div id="batch-progress" style="margin-top:15px; display:none;">
      <p id="batch-status-text" style="font-weight:bold; color:#007bff; margin-bottom:5px;">処理中...</p>
      <div id="batch-results-list"></div>
    </div>
    
    <button id="close-batch-modal" style="margin-top:20px; width:100%; padding:8px; background:#6c757d; color:#fff; border:none; border-radius:4px; font-size:13px; cursor:pointer;">閉じる</button>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById('close-batch-modal').onclick = function() { overlay.remove(); };

  // 3. 判定実行処理
  document.getElementById('run-batch-btn').onclick = async function() {
    const rawText = document.getElementById('cocolog-url-input').value;
    const urls = Array.from(new Set(rawText.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'))));

    if (urls.length === 0) {
      alert("有効なURLが入力されていません。httpから始まるURLを貼り付けてください。");
      return;
    }

    const progressDiv = document.getElementById('batch-progress');
    const statusText = document.getElementById('batch-status-text');
    const resultsList = document.getElementById('batch-results-list');

    progressDiv.style.display = "block";
    resultsList.innerHTML = "";
    this.disabled = true;
    this.style.background = "#ccc";

    let batchResults = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      statusText.innerText = `${i + 1} / ${urls.length} 件目を判定中...`;

      try {
        const response = await fetch(url);
        const htmlText = await response.text();

        const parser = new DOMParser();
        const targetDoc = parser.parseFromString(htmlText, 'text/html');

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
          m.push("カテゴリ設定なし");
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

        r.forEach(item => {
          if (item === "Googleマップ") {
            if (!pageText.includes("Googleマップ") && !gI && !gA) m.push("Googleマップ");
            else if ((gI || gA) && !hP(mU)) m.push("Googleマップ（ピン未設定）");
          } else {
            if (!pageText.includes(item)) m.push(item);
          }
        });

        if (/cit_[a-zA-Z0-9_-]{5,}/.test(fullHtml) || /data-cit/.test(fullHtml)) {
          l.push("AIコンテキストコード混入");
        }

        const sharpMatch = pageText.match(/#{2,}/);
        if (sharpMatch) l.push("連続シャープ検知: " + sharpMatch[0]);

        // 重複ワード検知
        const headingsForDup = mainArea.querySelectorAll('h1, h2, h3');
        headingsForDup.forEach(function(h){
          const ht = h.innerText.trim();
          if(/([一-龥]{2,})\1/.test(ht) || /([\u3040-\u309F]{2,})\1/.test(ht)) {
            l.push("見出し重複(連続ワード): " + ht);
          }
        });

        // リンク・バックスラッシュチェック
        const allLinks = mainArea.querySelectorAll('a[href]');
        let officialLinkCount = 0;
        let hasGmapLink = (gI || gA);
        allLinks.forEach(a => {
          const href = a.getAttribute('href');
          if (!href || !href.startsWith('http')) return;
          if (href.includes('\\')) l.push("URLにバックスラッシュ");
          if (href.includes('maps.google.com') || href.includes('google.com/maps') || href.includes('goo.gl/maps') || href.includes('maps.app.goo.gl')) {
            hasGmapLink = true;
          } else if (!href.includes('cocolog-nifty.com') && !href.includes('google.com')) {
            officialLinkCount++;
          }
        });

        if (officialLinkCount < 2) m.push("公式サイトリンク不足");
        if (!hasGmapLink) m.push("Googleマップリンク未設置");

        batchResults.push({
          title: tx || "タイトル取得不可",
          url: url,
          missing: m,
          errors: l,
          isOk: (m.length === 0 && l.length === 0)
        });

      } catch (err) {
        batchResults.push({
          title: "取得失敗",
          url: url,
          missing: ["ページ取得エラー"],
          errors: [],
          isOk: false
        });
      }
    }

    // 4. 結果の描画
    statusText.innerText = `完了！ (全 ${batchResults.length} 件)`;
    statusText.style.color = "#28a745";

    let resHtml = "<div style='margin-top:15px; border-top:2px solid #ddd; padding-top:10px;'>";
    batchResults.forEach((res, idx) => {
      const color = res.isOk ? "green" : "red";
      const icon = res.isOk ? "✅" : "❌";
      resHtml += `<div style='margin-bottom:10px; padding:8px 10px; background:#f8f9fa; border-left:4px solid ${color}; border-radius:3px;'>`;
      resHtml += `<div style='font-weight:bold; font-size:12px;'><a href='${res.url}' target='_blank' style='color:#333;'>${idx + 1}. ${icon} ${res.title}</a></div>`;
      if (!res.isOk) {
        resHtml += `<ul style='margin:4px 0 0 18px; padding:0; color:#d9534f; font-size:11px;'>`;
        res.missing.forEach(missingItem => resHtml += `<li>[不足] ${missingItem}</li>`);
        res.errors.forEach(errItem => resHtml += `<li>[異常] ${errItem}</li>`);
        resHtml += `</ul>`;
      }
      resHtml += `</div>`;
    });
    resHtml += "</div>";

    resultsList.innerHTML = resHtml;
    this.disabled = false;
    this.style.background = "#28a745";
  };
})();
