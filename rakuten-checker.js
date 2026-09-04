(function(){
  try {
    const pageText = document.body ? (document.body.innerText || "") : "";
    const fullHtml = document.body ? (document.body.innerHTML || "") : "";
    
    let missing = [];
    let issues = [];

    // 1. タイトルチェック
    const txtEl = document.querySelector('h1, .entry-title, .diary-title, [class*="title"]');
    const txt = txtEl ? txtEl.innerText.trim() : "";
    if(!txt) missing.push("記事タイトル");

    // 2. 本文エリアの特定（.real_entry_body 等）
    const b = document.querySelector('.real_entry_body, #entry_body, .dText, .entry_body, .entry-content');
    if(!b) {
      alert("エラー: 記事本文エリア（.real_entry_body 等）が見つかりません。公開ページで実行してください。");
      return;
    }

    // 3. 冒頭画像チェック
    const firstImg = b.querySelector('img');
    if(!firstImg) missing.push("冒頭画像（本文内に画像が見つかりません）");

    // 4. タイトル地名チェック
    if(txt && (/^(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/.test(txt) || /^.{1,5}[市区町村]/.test(txt))){
      issues.push("タイトル異常: 先頭が地名（「" + txt.substring(0,8) + "…」）");
    }

    // 5. カテゴリチェック
    if(!pageText.includes("カテゴリ") || pageText.includes("カテゴリ：未分類")){
      missing.push("カテゴリ（設定なしまたは未分類）");
    }

    // 6. 必須要素チェック
    const requiredItems = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
    requiredItems.forEach(item => {
      if(!pageText.includes(item)) missing.push(item);
    });

    // 7. AI参照コード混入チェック
    if(/cit_[a-zA-Z0-9_-]{3,}/i.test(fullHtml) || /data-cit/i.test(fullHtml) || /context[a-zA-Z0-9_-]*/i.test(fullHtml.slice(-2000)) || /cite/i.test(fullHtml.slice(-2000))){
      issues.push("AI参照コード混入疑い: 「cit_...」「context」等のAIコード・属性が検出されました");
    }

    // 8. AI「入力」不適切回答チェック
    const mainText = b.innerText || "";
    const aiPatterns = ["入力されています", "入力情報では", "入力されていません", "入力情報"];
    let foundAiWords = [];
    aiPatterns.forEach(pattern => {
      if (mainText.includes(pattern)) {
        foundAiWords.push(pattern);
      }
    });
    if (foundAiWords.length > 0) {
      issues.push("AI異常文言検出: 本文/Q&A内に「" + foundAiWords.join("」「") + "」が含まれています");
    }

    // 9. 編集部コメントURL判定
    const ci = pageText.indexOf("編集部コメント");
    if(ci !== -1){
      let ct = pageText.substring(ci);
      const mi = ct.indexOf("Googleマップ");
      if(mi !== -1) ct = ct.substring(0, mi);
      const u = (ct.match(/https?:\/\/[^\s\)\>\]]+/g) || []).filter(x => !x.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i));
      if(u.length >= 2 || /\[https?:\/\/[^\]]+\]\(https?:\/\/[^\)]+\)/.test(ct)){
        issues.push("編集部コメント異常: URL重複/崩れ");
      }
    }

    // 10. 本文エリア（b）からの外部リンク抽出（楽天ドメインは完全遮断）
    let targetUrls = new Set();
    let targetAnchors = [];

    // A: <a> タグ経由
    const anchors = Array.from(b.querySelectorAll('a'));
    anchors.forEach(a => {
      const rawHref = a.getAttribute('href') || '';
      if(!rawHref.startsWith('http://') && !rawHref.startsWith('https://')) return;

      try {
        const u = new URL(rawHref);
        if(!u.hostname.includes('rakuten')){
          targetUrls.add(rawHref);
          targetAnchors.push(a);
        }
      } catch(e){}
    });

    // B: 直書きテキスト経由（https://...）
    const rawMatches = mainText.match(/https?:\/\/[^\s\<\>"\']+/g) || [];
    rawMatches.forEach(url => {
      let clean = url.replace(/&amp;/g, '&').replace(/[\s\)\>\]]+$/, '');
      try {
        const u = new URL(clean);
        if(!u.hostname.includes('rakuten')){
          targetUrls.add(clean);
        }
      } catch(e){}
    });

    const finalUrlList = Array.from(targetUrls);

    // 別窓（target="_blank"）チェック
    let nonBlankLinks = targetAnchors.filter(a => {
      const t = (a.target || a.getAttribute('target') || '').toLowerCase();
      const r = (a.getAttribute('rel') || '').toLowerCase();
      return t !== '_blank' && !r.includes('noopener') && !r.includes('blank');
    });

    if(nonBlankLinks.length > 0){
      issues.push("リンク異常: 本文内のaタグリンクで別窓（target=\"_blank\"）になっていないものが " + nonBlankLinks.length + " 件あります");
    }

    // 結果表示メッセージの整形
    let msg = "【楽天ブログ判定結果】\n\n";
    if(missing.length === 0 && issues.length === 0){
      msg += "✅ 問題なし（全11項目・冒頭画像・カテゴリ・AIコード・AI不適切文言正常）\n";
    } else {
      msg += "❌ 要修正\n";
      if(missing.length > 0) msg += "\n■ 不足要素:\n・" + missing.join("\n・") + "\n";
      if(issues.length > 0) msg += "\n■ 異常検出:\n・" + issues.join("\n・") + "\n";
    }

    msg += "\n----------------------------------------\n";
    if(finalUrlList.length > 0) {
      msg += "【検出された外部リンク（" + finalUrlList.length + "件）】\n・" + finalUrlList.join("\n・");
    } else {
      msg += "【検出された外部リンク】\n・なし";
    }

    alert(msg);

    // リンクの一括展開（Googleマップ短縮URLのダイナミックリンクエラー対策済み）
    if(finalUrlList.length > 0 && confirm("検出された上記の対象リンク（" + finalUrlList.length + "件）をすべて別タブで開いて確認しますか？")){
      setTimeout(() => {
        finalUrlList.forEach(url => {
          let openTarget = url;
          // maps.app.goo.gl 等の短縮リンクで発生するダイナミックリンクエラーを回避
          if(url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')){
            openTarget = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(url);
          }
          window.open(openTarget, '_blank');
        });
      }, 100);
    }

  } catch(err) {
    alert("実行時エラー: " + err.message);
  }
})();
