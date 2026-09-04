(function(){
  try {
    const r = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
    let m = [], l = [];
    
    const txt = document.querySelector('h1, .heading-1, [class*="title"]') ? document.querySelector('h1, .heading-1, [class*="title"]').innerText.trim() : "";
    if(!txt) m.push("記事タイトル");
    
    const b = document.querySelector('main, article, .article-body, [class*="content"]') || document.body;
    const firstImg = b.querySelector('img');
    if(!firstImg) {
      m.push("冒頭画像（本文内に画像が見つかりません）");
    }
    
    if(txt && (/^(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/.test(txt) || /^.{1,5}[市区町村]/.test(txt))){
      l.push("タイトル異常: 先頭が地名（「" + txt.substring(0,8) + "…」）");
    }
    
    const pageText = document.body.innerText || "";
    const fullHtml = document.body.innerHTML || "";
    
    if(!pageText.includes("カテゴリ") || pageText.includes("カテゴリ：未分類")){
      m.push("カテゴリ（設定なしまたは未分類）");
    }
    
    r.forEach(i => {
      if(!pageText.includes(i)) m.push(i);
    });
    
    if(/cit_[a-zA-Z0-9_-]{3,}/i.test(fullHtml) || /data-cit/i.test(fullHtml) || /context[a-zA-Z0-9_-]*/i.test(fullHtml.slice(-2000)) || /cite/i.test(fullHtml.slice(-2000))){
      l.push("AI参照コード混入疑い: 「cit_...」「context」等のAIコード・属性が検出されました");
    }
    
    const ci = pageText.indexOf("編集部コメント");
    if(ci !== -1){
      let ct = pageText.substring(ci);
      const mi = ct.indexOf("Googleマップ");
      if(mi !== -1) ct = ct.substring(0, mi);
      const u = (ct.match(/https?:\/\/[^\s\)\>\]]+/g) || []).filter(x => !x.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i));
      if(u.length >= 2 || /\[https?:\/\/[^\]]+\]\(https?:\/\/[^\)]+\)/.test(ct)){
        l.push("編集部コメント異常: URL重複/崩れ");
      }
    }
    
    const links = Array.from(b.querySelectorAll('a')).filter(a => {
      const h = a.getAttribute('href');
      if(!h || h.startsWith('#') || h.startsWith('javascript:') || h.startsWith('mailto:') || h.startsWith('tel:')) return false;
      if(a.closest('header, footer, nav')) return false;
      return true;
    });
    
    let nonBlankLinks = links.filter(a => a.target !== '_blank');
    if(nonBlankLinks.length > 0){
      l.push("リンク異常: 記事内のリンクで別窓（target=\"_blank\"）になっていないものが " + nonBlankLinks.length + " 件あります");
    }
    
    let msg = "【STUDIO判定結果】\n";
    if(m.length === 0 && l.length === 0){
      msg += "✅ 問題なし（全11項目・冒頭画像・カテゴリ・AIコード・別窓リンク正常）";
    } else {
      msg += "❌ 要修正\n\n";
      if(m.length > 0) msg += "■ 不足要素:\n・" + m.join("\n・") + "\n\n";
      if(l.length > 0) msg += "■ 異常検出:\n・" + l.join("\n・") + "\n";
    }
    
    alert(msg);
    
    if(links.length > 0 && confirm("記事内のリンク（" + links.length + "件）をすべて別タブで開いて確認しますか？")){
      links.forEach(a => window.open(a.href, '_blank'));
    }
  } catch(e) {
    alert("エラー: " + e.message);
  }
})();
