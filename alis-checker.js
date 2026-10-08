(function(){
  // すでにパネルがあれば削除
  const existing = document.getElementById('alis-batch-checker');
  if(existing) existing.remove();

  // 入力用モーダルの作成
  const modal = document.createElement('div');
  modal.id = 'alis-batch-checker';
  modal.style.cssText = `
    position: fixed; top: 10px; right: 10px; width: 500px; max-height: 90vh;
    background: #fff; color: #333; z-index: 999999; box-shadow: 0 4px 25px rgba(0,0,0,0.4);
    border-radius: 8px; padding: 16px; font-family: sans-serif; font-size: 13px;
    display: flex; flex-direction: column; box-sizing: border-box; border: 2px solid #2196F3;
  `;

  modal.innerHTML = `
    <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #1976D2;">
      🚀 複数記事一括チェッカー（ALIS用）
      <button id="abc-close" style="float: right; background: #ff5252; color: #fff; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">✕ 閉じる</button>
    </h3>
    <p style="margin: 0 0 6px 0; color: #555; font-size: 12px;">チェックしたい記事のURLを1行に1つずつ貼り付けてください：</p>
    <textarea id="abc-urls" rows="6" placeholder="https://...&#10;https://..." style="width: 100%; padding: 6px; box-sizing: border-box; font-family: monospace; font-size: 12px; border: 1px solid #ccc; border-radius: 4px; resize: vertical;"></textarea>
    <button id="abc-run" style="margin-top: 8px; background: #2196F3; color: #fff; border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px;">一括チェック開始</button>
    <div id="abc-progress" style="margin-top: 8px; font-weight: bold; color: #333; font-size: 12px;"></div>
    <div id="abc-results" style="margin-top: 8px; flex: 1; overflow-y: auto; max-height: 50vh; border-top: 1px solid #e0e0e0; padding-top: 8px;"></div>
  `;

  document.body.appendChild(modal);

  document.getElementById('abc-close').addEventListener('click', function(){ modal.remove(); });

  document.getElementById('abc-run').addEventListener('click', async function(){
    const textarea = document.getElementById('abc-urls');
    const urls = textarea.value.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    const resultsDiv = document.getElementById('abc-results');
    const progressDiv = document.getElementById('abc-progress');

    if(urls.length === 0){
      alert("有効なURLが入力されていません。");
      return;
    }

    resultsDiv.innerHTML = "";
    progressDiv.innerText = `0 / ${urls.length} 記事をチェック中...`;

    let htmlReport = "";
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < urls.length; i++) {
      const targetUrl = urls[i];
      progressDiv.innerText = `(${i + 1} / ${urls.length}) 取得中: ${targetUrl}`;

      try {
        // fetchで対象ページのHTMLを取得
        const response = await fetch(targetUrl);
        const htmlText = await response.text();
        
        // 取得したHTMLをDOMに展開して解析
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');

        const pageText = doc.body ? (doc.body.innerText || "") : "";
        let missing = [];
        let issues = [];

        // タイトルチェック
        const txtEl = doc.querySelector('h1, .article-title, [class*="title"]');
        const txt = txtEl ? txtEl.innerText.trim() : "";
        if(!txt) missing.push("記事タイトル");

        // 本文エリアの特定
        const b = doc.querySelector('.area-content, .ck-content, [class*="area-content"], [class*="ck-content"], article, main') || doc.body;

        // 冒頭画像チェック
        const firstImg = b ? b.querySelector('img') : null;
        if(!firstImg) missing.push("冒頭画像");

        // カテゴリ（area-title）チェック
        const categoryEl = doc.querySelector('.area-title, [class*="area-title"]');
        const categoryText = categoryEl ? categoryEl.innerText.trim() : "";
        if (!categoryEl || !categoryText || categoryText.includes("未分類") || categoryText.includes("設定なし")) {
          missing.push("カテゴリ（area-title）");
        }

        // 必須項目チェック
        const requiredItems = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
        requiredItems.forEach(function(item){
          if(!pageText.includes(item)) missing.push(item);
        });

        // AI参照コードチェック
        if(/cit_[a-zA-Z0-9_-]{3,}/i.test(htmlText) || /data-cit/i.test(htmlText)){
          issues.push("AI参照コード混入");
        }

        // 外部リンク抽出
        let collectedUrls = [];
        const currentHost = new URL(targetUrl).hostname;
        const anchors = Array.from(b.querySelectorAll('a'));
        anchors.forEach(function(a){
          const rawHref = a.getAttribute('href') || '';
          if(rawHref.startsWith('http://') || rawHref.startsWith('https://')){
            try {
              const u = new URL(rawHref);
              if(u.hostname !== currentHost && !u.hostname.includes('alis.to')){
                collectedUrls.push(rawHref);
              }
            } catch(e){}
          }
        });

        // 結果の集計
        if(missing.length === 0 && issues.length === 0){
          successCount++;
          htmlReport += `<div style="background:#e8f5e9; padding:6px; margin-bottom:6px; border-radius:4px; font-size:12px;">
            ✅ <a href="${targetUrl}" target="_blank" style="color:#2e7d32; font-weight:bold;">${targetUrl}</a> (問題なし)
          </div>`;
        } else {
          errorCount++;
          htmlReport += `<div style="background:#ffebee; padding:6px; margin-bottom:6px; border-radius:4px; font-size:12px;">
            ❌ <a href="${targetUrl}" target="_blank" style="color:#c62828; font-weight:bold;">${targetUrl}</a><br>
            ${missing.length > 0 ? '<b>不足:</b> ' + missing.join(', ') + '<br>' : ''}
            ${issues.length > 0 ? '<b>異常:</b> ' + issues.join(', ') : ''}
          </div>`;
        }

      } catch (err) {
        errorCount++;
        htmlReport += `<div style="background:#fff3e0; padding:6px; margin-bottom:6px; border-radius:4px; font-size:12px;">
          ⚠️ <a href="${targetUrl}" target="_blank" style="color:#e65100; font-weight:bold;">${targetUrl}</a> (取得失敗・アクセス制限等)
        </div>`;
      }

      resultsDiv.innerHTML = htmlReport;
    }

    progressDiv.innerText = `完了！ 正常: ${successCount}件 / 要確認・エラー: ${errorCount}件`;
  });
})();
