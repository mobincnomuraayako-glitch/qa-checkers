(function(){
  async function runBatchCheck() {
    // 1. 記事一覧ページから記事のリンク（URLとタイトル）を自動抽出
    const linkElements = document.querySelectorAll('.entry-title a, .entry-subject a, h3 a, h2 a, a[href*=".html"]');
    let targets = [];
    
    linkElements.forEach(a => {
      const href = a.href;
      const title = a.innerText.trim();
      if (href && !targets.some(t => t.url === href) && (href.includes('cocolog-nifty.com') || href.startsWith('http'))) {
        targets.push({ url: href, title: title });
      }
    });

    // 重複や余分なリンクを除外し、最大50件に絞る
    targets = targets.slice(0, 50);

    if (targets.length === 0) {
      alert("この記事一覧ページから判定対象のリンクが見つかりませんでした。記事一覧画面でお試しください。");
      return;
    }

    // 進捗表示用モーダルの作成
    let progressOverlay = document.getElementById('cocolog-batch-modal');
    if (progressOverlay) progressOverlay.remove();

    progressOverlay = document.createElement('div');
    progressOverlay.id = 'cocolog-batch-modal';
    progressOverlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999999; display:flex; align-items:center; justify-content:center; font-family:sans-serif;";
    
    const progressBox = document.createElement('div');
    progressBox.style.cssText = "background:#fff; padding:25px 30px; border-radius:8px; width:90%; max-width:650px; max-height:85vh; overflow-y:auto; box-shadow:0 4px 20px rgba(0,0,0,0.3); font-size:13px; color:#333;";
    progressBox.innerHTML = `<h2 style='margin-top:0; font-size:18px;'>【一括DOM判定 実行中...】</h2><p id='batch-status' style='font-weight:bold; color:#007bff;'>0 / ${targets.length} 記事をチェック中...</p><div id='batch-results-preview' style='margin-top:15px; max-height:50vh; overflow-y:auto; border-top:1px solid #eee; padding-top:10px;'></div>`;
    
    progressOverlay.appendChild(progressBox);
    document.body.appendChild(progressOverlay);

    const statusText = document.getElementById('batch-status');
    const previewContainer = document.getElementById('batch-results-preview');
    let batchResults = [];

    // 2. 1件ずつフェッチして判定を実行
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      statusText.innerText = `${i + 1} / ${targets.length} 記事をチェック中: ${target.title || target.url}`;

      try {
        const response = await fetch(target.url);
        const htmlText = await response.text();
        
        // 取得したHTMLを仮想DOMに展開して解析
        const parser = new DOMParser();
        const targetDoc = parser.parseFromString(htmlText, 'text/html');

        const r = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
        let m = [], l = [];

        const pageText = (targetDoc.body ? targetDoc.body.innerText : "").replace(/\s+/g, " ");
        const fullHtml = targetDoc.body ? targetDoc.body.innerHTML : "";
        const mainArea = targetDoc.querySelector('.entry-body,.entry-content,.entry,.entry-inner,#alpha-inner') || targetDoc.body;
        
        const txE = targetDoc.querySelector('.entry-header,.entry-title,h3.entry-header,h1,.entry-subject');
        const tx = txE ? txE.innerText.trim() : target.title;
        if (!tx) m.push("記事タイトル");

        const fI = mainArea.querySelector('img');
        if (!fI) m.push("画像設置（本文内に画像が見つかりません）");

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

        r.forEach(i => {
          if (i === "Googleマップ") {
            if (!pageText.includes("Googleマップ") && !gI && !gA) m.push("Googleマップ");
            else if ((gI || gA) && !hP(mU)) m.push("Googleマップ（ピン未設定）");
          } else {
            if (!pageText.includes(i)) m.push(i);
          }
        });

        if (/cit_[a-zA-Z0-9_-]{5,}/.test(fullHtml) || /data-cit/.test(fullHtml)) {
          l.push("AIコンテキストコード混入");
        }

        const sharpMatch = pageText.match(/#{2,}/);
        if (sharpMatch) l.push("連続シャープ検知: " + sharpMatch[0]);

        // バックスラッシュチェック
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
          title: tx || target.title || "無題の記事",
          url: target.url,
          missing: m,
          errors: l,
          isOk: (m.length === 0 && l.length === 0)
        });

      } catch (err) {
        batchResults.push({
          title: target.title || target.url,
          url: target.url,
          missing: ["ページ取得・解析エラー (CORS/アクセス権等)"],
          errors: [],
          isOk: false
        });
      }
    }

    // 3. 全判定終了後、結果を綺麗に一覧表示
    let finalHtml = "<h2 style='margin-top:0; font-size:18px;'>【一括判定 結果一覧 (" + batchResults.length + "記事)】</h2>";
    
    batchResults.forEach((res, index) => {
      const statusColor = res.isOk ? "green" : "red";
      const statusIcon = res.isOk ? "✅" : "❌";
      
      finalHtml += `<div style='margin-bottom:12px; padding:10px; background:#f9f9f9; border-left:4px solid ${statusColor}; border-radius:4px;'>`;
      finalHtml += `<div style='font-weight:bold; font-size:13px;'><a href='${res.url}' target='_blank' style='color:#333; text-decoration:none;'>${index + 1}. ${statusIcon} ${res.title}</a></div>`;
      
      if (!res.isOk) {
        finalHtml += "<ul style='margin:5px 0 0 20px; padding:0; color:#d9534f; font-size:12px;'>";
        res.missing.forEach(item => finalHtml += `<li>[不足] ${item}</li>`);
        res.errors.forEach(item => finalHtml += `<li>[異常] ${item}</li>`);
        finalHtml += "</ul>";
      } else {
        finalHtml += "<div style='color:green; font-size:11px; margin-top:3px;'>問題なし</div>";
      }
      finalHtml += `</div>`;
    });

    progressBox.innerHTML = finalHtml + "<button id='close-batch-modal' style='display:block; width:100%; margin-top:20px; padding:10px; background:#007bff; color:#fff; border:none; border-radius:4px; font-size:15px; cursor:pointer; font-weight:bold;'>閉じる</button>";
    
    document.getElementById('close-batch-modal').onclick = function() {
      progressOverlay.remove();
    };
  }

  runBatchCheck();
})();
