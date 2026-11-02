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
    <textarea id="cocolog-url-input" rows="8" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px; font-family:monospace; font-size:12px; box-sizing:border-box;" placeholder="https://omisenote01.cocolog-nifty.com/blog/2026/01/post-xxx.html&#10;https://omisenote01.cocolog-nifty.com/blog/2026/01/post-yyy.html"></textarea>
    
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
    const urls = Array.from(new Set(rawText.split('\n').map(u => u.trim()).filter(u => u.startsWith
