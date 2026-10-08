(function(){
  const existing = document.getElementById('alis-batch-checker');
  if(existing) existing.remove();
  const existingOverlay = document.getElementById('alis-batch-checker-overlay');
  if(existingOverlay) existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'alis-batch-checker-overlay';
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.6); z-index: 999998;';

  const modal = document.createElement('div');
  modal.id = 'alis-batch-checker';
  modal.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 750px; max-width: 95vw; height: 85vh; background: #fff; color: #333; z-index: 999999; box-shadow: 0 10px 40px rgba(0,0,0,0.5); border-radius: 12px; padding: 24px; font-family: sans-serif; display: flex; flex-direction: column; box-sizing: border-box; border: 3px solid #2196F3;';

  modal.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <h3 style="margin: 0; font-size: 18px; color: #1976D2;">🚀 ALIS 複数記事一括チェッカー（半角カナ詳細表示版）</h3>
      <button id="abc-close" style="background: #ff5252; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold;">✕ 閉じる</button>
    </div>
    <p style="margin: 0 0 6px 0; color: #555; font-size: 13px;">チェックしたい記事のURLを1行に1つずつ貼り付けてください：</p>
    <textarea id="abc-urls" rows="5" placeholder="https://...&#10;https://..." style="width: 100%; padding: 10px; box-sizing: border-box; font-family: monospace; font-size: 13px; border: 1px solid #ccc; border-radius: 6px; resize: vertical;"></textarea>
    <button id="abc-run" style="margin-top: 10px; background: #2196F3; color: #fff; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">一括チェック開始</button>
    <div id="abc-progress" style="margin-top: 10px; font-weight: bold; color: #333; font-size: 13px;"></div>
    <div id="abc-results" style="margin-top: 10px; flex: 1; overflow-y: auto; border: 1px solid #ddd; border-radius: 6px; padding: 10px; background: #fafafa;"></div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  function closeModal() {
    modal.remove();
    overlay.remove();
  }
  document.getElementById('abc-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);

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
      progressDiv.innerText = `(${i + 1} / ${urls.length}) 取得・解析中: ${targetUrl}`;

      let okItems = [];
      let missing = [];
      let issues = [];

      try {
        const response = await fetch(targetUrl);
        if(!response.ok) throw new Error('HTTP ' + response.status);
        const htmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');

        const pageText = doc.body ? (doc.body.innerText || "") : "";

        // 1. タイトルチェック
        const txtEl = doc.querySelector('h1, .article-title, [class*="title"]');
        const txt = txtEl ? txtEl.innerText.trim() : "";
        if(txt) {
          okItems.push("記事タイトル: " + txt.substring(0, 20) + "...");
        } else {
          missing.push("記事タイトル");
        }

        // 2. 冒頭画像チェック
        const b = doc.querySelector('.area-content, .ck-content, [class*="area-content"], [class*="ck-content"], article, main') || doc.body;
        const firstImg = b ? b.querySelector('img') : null;
        if(firstImg) {
          okItems.push("冒頭画像");
        } else {
          missing.push("冒頭画像");
        }

        // 3. カテゴリチェック
        const categoryEl = doc.querySelector('.area-title, [class*="area-title"]');
        const categoryText = categoryEl ? categoryEl.innerText.trim() : "";
        if (categoryEl && categoryText && !categoryText.includes("未分類") && !categoryText.includes("設定なし")) {
          okItems.push("カテゴリ (" + categoryText + ")");
        } else {
          missing.push("カテゴリ（area-title）");
        }

        // 4. 必須項目の網羅チェック
        const requiredItems = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
        requiredItems.forEach(function(item){
          if(pageText.includes(item)) {
            okItems.push(item);
          } else {
            missing.push(item);
          }
        });

        // 5. AI参照コードの混入チェック
        if(/cit_[a-zA-Z0-9_-]{3,}/i.test(htmlText) || /data-cit/i.test(htmlText)){
          issues.push("AI参照コード混入");
        } else {
          okItems.push("AI参照コードなし");
        }

        // 6. 半角カタカナの混入チェック（見つかった具体的な文字や周辺も抜き出す）
        const halfKanaRegex = /[\uff66-\uff9f]+/g;
        const matchedKanas = pageText.match(halfKanaRegex);
        if (matchedKanas && matchedKanas.length > 0) {
          // 重複を削って、見つかった半角カナをまとめる
          const uniqueKanas = Array.from(new Set(matchedKanas)).join(', ');
          issues.push(`半角カタカナ混入: [ ${uniqueKanas} ]`);
        } else {
          okItems.push("半角カタカナなし");
        }

        // 結果の出力組み立て
        if(missing.length === 0 && issues.length === 0){
          successCount++;
          htmlReport += `<div style="background:#e8f5e9; border-left: 5px solid #2e7d32; padding:10px; margin-bottom:10px; border-radius:4px; font-size:13px;">
            ✅ <b><a href="${targetUrl}" target="_blank" style="color:#2e7d32; text-decoration:underline;">${targetUrl}</a></b><br>
            <span style="color:#2e7d32; font-weight:bold;">【判定: 問題なし】</span><br>
            <div style="color:#1b5e20; margin-top:4px; font-size:12px; background:rgba(255,255,255,0.6); padding:6px; border-radius:4px;">
              <b>✔ クリアした項目 (${okItems.length}件):</b><br>${okItems.join(' / ')}
            </div>
          </div>`;
        } else {
          errorCount++;
          htmlReport += `<div style="background:#ffebee; border-left: 5px solid #c62828; padding:10px; margin-bottom:10px; border-radius:4px; font-size:13px;">
            ❌ <b><a href="${targetUrl}" target="_blank" style="color:#c62828; text-decoration:underline;">${targetUrl}</a></b><br>
            <span style="color:#c62828; font-weight:bold;">【判定: 要確認・エラーあり】</span><br>
            ${missing.length > 0 ? `<div style="color:#c62828; margin-top:4px; background:rgba(255,255,255,0.8); padding:6px; border-radius:4px;">❌ <b>不足している項目 (${missing.length}件):</b><br>${missing.join(' / ')}</div>` : ''}
            ${issues.length > 0 ? `<div style="color:#e65100; margin-top:4px; background:rgba(255,255,255,0.8); padding:6px; border-radius:4px;">⚠️ <b>異常・注意（半角カナ・AIコード等）:</b><br>${issues.join('<br>')}</div>` : ''}
            <div style="color:#2e7d32; margin-top:4px; font-size:12px; background:rgba(255,255,255,0.6); padding:6px; border-radius:4px;">
              <b>✔ クリアした項目 (${okItems.length}件):</b><br>${okItems.join(' / ')}
            </div>
          </div>`;
        }

      } catch (err) {
        errorCount++;
        htmlReport += `<div style="background:#fff3e0; border-left: 5px solid #e65100; padding:10px; margin-bottom:10px; border-radius:4px; font-size:13px;">
          ⚠️ <b><a href="${targetUrl}" target="_blank" style="color:#e65100; text-decoration:underline;">${targetUrl}</a></b><br>
          <span style="color:#e65100; font-weight:bold;">【取得失敗】</span><br>
          <span style="color:#e65
