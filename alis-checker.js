(function(){
  // すでにパネルがあれば削除
  const existing = document.getElementById('alis-batch-checker');
  if(existing) existing.remove();

  // 背景を暗くするオーバーレイ（背景モヤ）の作成
  const overlay = document.createElement('div');
  overlay.id = 'alis-batch-checker-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.5); z-index: 999998;
  `;

  // 入力・結果表示用の中央モーダルの作成
  const modal = document.createElement('div');
  modal.id = 'alis-batch-checker';
  modal.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 700px; max-width: 90vw; max-height: 85vh;
    background: #fff; color: #333; z-index: 999999; box-shadow: 0 8px 30px rgba(0,0,0,0.5);
    border-radius: 12px; padding: 24px; font-family: sans-serif; font-size: 14px;
    display: flex; flex-direction: column; box-sizing: border-box; border: 3px solid #2196F3;
  `;

  modal.innerHTML = `
    <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #1976D2; display: flex; justify-content: space-between; align-items: center;">
      <span>🚀 複数記事一括チェッカー（ALIS用）</span>
      <button id="abc-close" style="background: #ff5252; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold;">✕ 閉じる</button>
    </h3>
    <p style="margin: 0 0 8px 0; color: #555; font-size: 13px;">チェックしたい記事のURLを1行に1つずつ貼り付けてください：</p>
    <textarea id="abc-urls" rows="8" placeholder="https://...&#10;https://..." style="width: 100%; padding: 10px; box-sizing: border-box; font-family: monospace; font-size: 13px; border: 1px solid #ccc; border-radius: 6px; resize: vertical;"></textarea>
    <button id="abc-run" style="margin-top: 12px; background: #2196F3; color: #fff; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">一括チェック開始</button>
    <div id="abc-progress" style="margin-top: 12px; font-weight: bold; color: #333; font-size: 13px;"></div>
    <div id="abc-results" style="margin-top: 10px; flex: 1; overflow-y: auto; max-height: 45vh; border-top: 2px solid #e0e0e0; padding-top: 10px;"></div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  // 閉じる処理
  function closeModal() {
    modal.remove();
    overlay.remove();
  }
  document.getElementById('abc-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);

  // 一括チェック実行処理
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
        const response = await fetch(targetUrl);
        const htmlText = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');

        const pageText = doc.body ? (doc.body.innerText || "") : "";
        let missing = [];
        let issues = [];

        // タイトルチェック
        const txtEl = doc.querySelector('h1, .article-title, [class*="title"]');
        const txt = txtEl ? txtEl.innerText.trim() : "";
        if(!txt) missing.push("記事タイトル");

        // 本文エリア
        const b = doc.querySelector('.area-content, .ck-content, [class*="area-content"], [class*="ck-content"], article, main') || doc.body;

        // 冒頭画像
        const firstImg = b ? b.querySelector('img') : null;
        if(!firstImg) missing.push("冒頭画像");

        // カテゴリ（area-title）
        const categoryEl = doc.querySelector('.area-title, [class*="area-title"]');
        const categoryText = categoryEl ? categoryEl.innerText.trim() : "";
        if (!categoryEl || !categoryText || categoryText.includes("未分類") || categoryText.includes("設定なし")) {
          missing.push("カテゴリ（area-title）");
        }

        // 必須項目
        const requiredItems = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
        requiredItems.forEach(function(item){
          if(!pageText.includes(item)) missing.push(item);
        });

        // AI参照コード
        if(/cit_[a-zA-Z0-9_-]{3,}/i.test(htmlText) || /data-cit/i.test(htmlText)){
          issues.push("AI参照コード混入");
        }

        // 結果集計
        if(missing.length === 0 && issues.length === 0){
          successCount++;
          htmlReport += `<div style="background:#e8f5e9; padding:8px 12px; margin-bottom:8px; border-radius:6px; font-size:13px;">
            ✅ <a href="${targetUrl}" target="_blank" style="color:#2e7d32; font-weight:bold; text-decoration:underline;">${targetUrl}</a> (問題なし)
          </div>`;
        } else {
          errorCount++;
          htmlReport += `<div style="background:#ffebee; padding:8px 12px; margin-bottom:8px; border-radius:6px; font-size:13px;">
            ❌ <a href="${targetUrl}" target="_blank" style="color:#c62828; font-weight:bold; text-decoration:underline;">${targetUrl}</a><br>
            ${missing.length > 0 ? '<b>不足:</b> ' + missing.join(', ') + '<br>' : ''}
            ${issues.length > 0 ? '<b>異常:</b> ' + issues.join(', ') : ''}
          </div>`;
        }

      } catch (err) {
        errorCount++;
        htmlReport += `<div style="background:#fff3e0; padding:8px 12px; margin-bottom:8px; border-radius:6px; font-size:13px;">
          ⚠️ <a href="${targetUrl}" target="_blank" style="color:#e65100; font-weight:bold; text-decoration:underline;">${targetUrl}</a> (取得失敗・CORS制限等)
        </div>`;
      }

      resultsDiv.innerHTML = htmlReport;
    }

    progressDiv.innerText = `完了！ 正常: ${successCount}件 / 要確認・エラー: ${errorCount}件`;
  });
})();
