(function(){
  try {
    // --- 1. ページ全体のテキストとHTMLの取得 ---
    const pageText = document.body ? (document.body.innerText || "") : "";
    const fullHtml = document.body ? (document.body.innerHTML || "") : "";
    
    let missing = [];
    let issues = [];

    // --- 2. 記事タイトルのチェック ---
    const txtEl = document.querySelector('h1, .article-title, [class*="title"]');
    const txt = txtEl ? txtEl.innerText.trim() : "";
    if(!txt) missing.push("記事タイトル");

    // --- 3. 本文エリアの特定（指定されたクラス名に対応） ---
    const b = document.querySelector('.area-content, .ck-content, [class*="area-content"], [class*="ck-content"], article, main') || document.body;

    // --- 4. 冒頭画像の存在チェック ---
    const firstImg = b ? b.querySelector('img') : null;
    if(!firstImg) missing.push("冒頭画像（本文内に画像が見つかりません）");

    // --- 5. タイトル先頭の地名チェック ---
    if(txt && (/^(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/.test(txt) || /^.{1,5}[市区町村]/.test(txt))){
      issues.push("タイトル異常: 先頭が地名（「" + txt.substring(0,8) + "…」）");
    }

    // --- 6. カテゴリ（area-title）およびタグ（tag-inner）のチェック ---
    const categoryEl = document.querySelector('.area-title, [class*="area-title"]');
    const categoryText = categoryEl ? categoryEl.innerText.trim() : "";
    
    const tagEl = document.querySelector('.tag-inner, [class*="tag-inner"]');
    const tagText = tagEl ? tagEl.innerText.trim() : "";

    // カテゴリが取得できない、空欄、または「未分類」が含まれている場合
    if (!categoryEl || !categoryText || categoryText.includes("未分類") || categoryText.includes("設定なし")) {
      missing.push("カテゴリ（area-title: 設定なしまたは未分類）");
    }

    // --- 7. 必須要素（見出し項目）の存在チェック ---
    const requiredItems = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
    requiredItems.forEach(function(item){
      if(!pageText.includes(item)) missing.push(item);
    });

    // --- 8. AI参照コードの混入チェック ---
    if(/cit_[a-zA-Z0-9_-]{3,}/i.test(fullHtml) || /data-cit/i.test(fullHtml) || /context[a-zA-Z0-9_-]*/i.test(fullHtml.slice(-2000)) || /cite/i.test(fullHtml.slice(-2000))){
      issues.push("AI参照コード混入疑い: 「cit_...」「context」等のAIコード・属性が検出されました");
    }

    // --- 9. AIの不適切な「入力」文言の混入チェック ---
    const rawMainText = b.innerText || "";
    const cleanMainText = rawMainText.replace(/0\d{1,4}-\d{1,4}-\d{3,4}/g, "");
    const aiPatterns = ["入力されています", "入力情報では", "入力されていません", "入力情報", "「-」と入力", "は「-」"];
    let foundAiWords = [];
    aiPatterns.forEach(function(pattern){
      if (cleanMainText.includes(pattern)) {
        foundAiWords.push(pattern);
      }
    });
    if (foundAiWords.length > 0) {
      issues.push("AI異常文言検出: 本文/Q&A内に「" + Array.from(new Set(foundAiWords)).join("」「") + "」が含まれています");
    }

    // --- 10. 見出しおよび本文中の連続重複ワード（「葬儀葬儀」など）の判定 ---
    const headings = b.querySelectorAll('h1, h2, h3');
    headings.forEach(function(h){
        const ht = h.innerText.trim();
        if(/([一-龥]{2,})\1/.test(ht) || /([\u3040-\u309F]{2,})\1/.test(ht)) {
            issues.push("見出しの重複異常(連続ワード): " + ht);
        }
    });

    const paragraphs = b.querySelectorAll('p, li');
    paragraphs.forEach(function(p){
        const pt = p.innerText.trim();
        const matchKanji = pt.match(/([一-龥]{2,})\1/);
        const matchHira = pt.match(/([\u3040-\u309F]{2,})\1/);
        if((matchKanji || matchHira) && !issues.some(function(msg){ return msg.includes("本文中の重複異常"); })) {
            const dupWord = matchKanji ? matchKanji[1] : matchHira[1];
            issues.push("本文中の重複異常(連続ワード検知): " + dupWord);
        }
    });

    // --- 11. アクセス所要時間抜けチェック ---
    if (/駅/.test(rawMainText)) {
        var hasAccessTime = /(徒歩|車|バス|タクシー)?\s*\d+\s*分/.test(rawMainText);
        if (!hasAccessTime) {
            issues.push("アクセス所要時間抜け: 本文中に「駅」の記載がありますが、徒歩・車などの所要時間（〇分）が見つかりません");
        }
    }

    // --- 12. 編集部コメント周辺のURL重複・崩れ判定 ---
    const ci = pageText.indexOf("編集部コメント");
    if(ci !== -1){
      let ct = pageText.substring(ci);
      const mi = ct.indexOf("Googleマップ");
      if(mi !== -1) ct = ct.substring(0, mi);
      const u = (ct.match(/https?:\/\/[^\s\)\>\]]+/g) || []).filter(function(x){ return !x.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i); });
      if(u.length >= 2 || /\[https?:\/\/[^\]]+\]\(https?:\/\/[^\)]+\)/.test(ct)){
        issues.push("編集部コメント異常: URL重複/崩れ");
      }
    }

    // --- 13. 本文エリアからの外部リンク抽出（自社ドメイン除外） ---
    let collectedUrls = [];
    let targetAnchors = [];
    const currentHost = location.hostname;

    const anchors = Array.from(b.querySelectorAll('a'));
    anchors.forEach(function(a){
      const rawHref = a.getAttribute('href') || '';
      if(!rawHref.startsWith('http://') && !rawHref.startsWith('https://')) return;

      try {
        const u = new URL(rawHref);
        if(u.hostname !== currentHost && !u.hostname.includes('alis.to')){
          collectedUrls.push(rawHref);
          targetAnchors.push(a);
        }
      } catch(e){}
    });

    const rawMatches = rawMainText.match(/https?:\/\/[^\s\<\>"\']+/g) || [];
    rawMatches.forEach(function(url){
      let clean = url.replace(/&amp;/g, '&').replace(/[\s\)\>\]]+$/, '');
      try {
        const u = new URL(clean);
        if(u.hostname !== currentHost && !u.hostname.includes('alis.to')){
          collectedUrls.push(clean);
        }
      } catch(e){}
    });

    const finalUrlList = Array.from(new Set(collectedUrls));

    // --- 14. 外部リンクの別窓（target="_blank"）設定チェック ---
    let nonBlankLinks = targetAnchors.filter(function(a){
      const t = (a.target || a.getAttribute('target') || '').toLowerCase();
      const r = (a.getAttribute('rel') || '').toLowerCase();
      return t !== '_blank' && !r.includes('noopener') && !r.includes('blank');
    });

    if(nonBlankLinks.length > 0){
      issues.push("リンク異常: 本文内のaタグリンクで別窓（target=\"_blank\"）になっていないものが " + nonBlankLinks.length + " 件あります");
    }

    // --- 15. 判定結果メッセージの組み立て ---
    let msg = "【ALIS判定結果】\n\n";
    if(missing.length === 0 && issues.length === 0){
      msg += "✅ 問題なし（全項目・冒頭画像・カテゴリ・AIコード・AI不適切文言・重複ワード・アクセス時間・別窓正常）\n";
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

    // --- 16. 検出されたリンクの一括別タブ展開確認 ---
    if(finalUrlList.length > 0 && confirm("確認対象のリンク（" + finalUrlList.length + "件）をすべて別タブで開きますか？")){
      setTimeout(function(){
        finalUrlList.forEach(function(url){
          window.open(url, '_blank');
        });
      }, 100);
    }

  } catch(err) {
    alert("実行時エラー: " + err.message);
  }
})();
