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

    // 2. 冒頭画像チェック
    const b = document.querySelector('.entry-content, .diary-content, article, main') || document.body;
    const firstImg = b ? b.querySelector('img') : null;
    if(!firstImg) missing.push("冒頭画像（本文内に画像が見つかりません）");

    // 3. タイトル地名チェック
    if(txt && (/^(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/.test(txt) || /^.{1,5}[市区町村]/.test(txt))){
      issues.push("タイトル異常: 先頭が地名（「" + txt.substring(0,8) + "…」）");
    }

    // 4. カテゴリチェック
    if(!pageText.includes("カテゴリ") || pageText.includes("カテゴリ：未分類")){
      missing.push("カテゴリ（設定なしまたは未分類）");
    }

    // 5. 必須要素チェック
    const requiredItems = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
    requiredItems.forEach(item => {
      if(!pageText.includes(item)) missing.push(item);
    });

    // 6. AI参照コード混入チェック
    if(/cit_[a-zA-Z0-9_-]{3,}/i.test(fullHtml) || /data-cit/i.test(fullHtml) || /context[a-zA-Z0-9_-]*/i.test(fullHtml.slice(-2000)) || /cite/i.test(fullHtml.slice(-2000))){
      issues.push("AI参照コード混入疑い: 「cit_...」「context」等のAIコード・属性が検出されました");
    }

    // 7. 編集部コメントURL判定
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

    // 8. 対象エリア（店舗情報テーブル・Googleマップ・編集部コメント）限定チェック
    const currentHost = location.hostname;
    let rawTargetLinks = Array.from(document.querySelectorAll('td a'));

    Array.from(document.querySelectorAll('a')).forEach(a => {
      const h = a.getAttribute('href') || '';
      if(h.includes('maps.google') || h.includes('goo.gl/maps') || h.includes('google.com/maps')){
        rawTargetLinks.push(a);
      }
    });

    const headings = Array.from(document.querySelectorAll('h2, h3, h4, [class*="heading"]'));
    const commentHeading = headings.find(h => h.innerText && h.innerText.includes('編集部コメント'));
    if(commentHeading){
      let parent = commentHeading.parentElement;
      if(parent){
        Array.from(parent.querySelectorAll('a')).forEach(a => rawTargetLinks.push(a));
      }
    }

    const uniqueElements = Array.from(new Set(rawTargetLinks));
    const extLinks = uniqueElements.filter(a => {
      const h = a.getAttribute('href') || '';
      if(!h.startsWith('http')) return false;
      try {
        const u = new URL(h);
        return u.hostname !== currentHost;
      } catch(e) {
        return false;
      }
    });

    let nonBlankLinks = extLinks.filter(a => {
      const t = (a.target || a.getAttribute('target') || '').toLowerCase();
      const r = (a.getAttribute('rel') || '').toLowerCase();
      return t !== '_blank' && !r.includes('noopener') && !r.includes('blank');
    });

    if(nonBlankLinks.length > 0){
      issues.push("リンク異常: 店舗情報・編集部コメント内のリンクで別窓（target=\"_blank\"）になっていないものが " + nonBlankLinks.length + " 件あります");
    }

    // 結果表示
    let msg = "【楽天ブログ判定結果】\n";
    if(missing.length === 0 && issues.length === 0){
      msg += "✅ 問題なし（全11項目・冒頭画像・カテゴリ・AIコード・対象リンク別窓正常: " + extLinks.length + "件検知）";
    } else {
      msg += "❌ 要修正\n\n";
      if(missing.length > 0) msg += "■ 不足要素:\n・" + missing.join("\n・") + "\n\n";
      if(issues.length > 0) msg += "■ 異常検出:\n・" + issues.join("\n・") + "\n";
    }

    alert(msg);

    if(extLinks.length > 0 && confirm("検出された対象リンク（" + extLinks.length + "件）をすべて別タブで開いて確認しますか？")){
      extLinks.forEach(a => window.open(a.href, '_blank'));
    }

  } catch(err) {
    alert("実行時エラー: " + err.message);
  }
})();
