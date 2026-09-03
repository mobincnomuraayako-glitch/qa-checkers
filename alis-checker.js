(function() {
  try {
    // ALISの要素取得処理
    const title = document.querySelector('h1')?.innerText || '';
    const bodyText = document.body.innerText || '';
    
    let missing = [];
    if (!title) missing.push('記事タイトル');
    
    // 基本要素のチェック例
    const checks = ["基本情報", "店舗概要", "所在地・アクセス", "営業時間・定休日", "まとめ"];
    checks.forEach(item => {
      if (!bodyText.includes(item)) missing.push(item);
    });

    let msg = "【ALIS判定結果】\n";
    if (missing.length === 0) {
      msg += "✅ 問題なし";
    } else {
      msg += "❌ 要修正\n\n■ 不足要素:\n・" + missing.join("\n・");
    }
    alert(msg);
  } catch (e) {
    alert("エラー: " + e.message);
  }
})();
