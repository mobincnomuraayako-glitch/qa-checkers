(function(){
  try {
    const r = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
    let m = [], l = [];

    const mainContent = document.querySelector('.entry-body, .entry-content, .entry') || document.body;

    // 1. Googleマップ要素の検出とピン判定
    const gmapIframe = mainContent.querySelector('iframe[src*="maps.google.com"], iframe[src*="google.com/maps"]');
    const gmapAnchor = mainContent.querySelector('a[href*="maps.google.com"], a[href*="google.com/maps"], a[href*="goo.gl/maps"]');

    function hasMapPin(url) {
      if (!url) return false;
      return /[?&](q|query|cid)=/.test(url) || /!3d[-0-9.]*!4d[-0-9.]*/.test(url) || url.includes('maps.google.com/1');
    }

    let mapUrl = "";
    if (gmapIframe) mapUrl = gmapIframe.getAttribute('src') || "";
    else if (gmapAnchor) mapUrl = gmapAnchor.getAttribute('href') || "";

    // 2. タイトルチェック
    const txtEl = document.querySelector('.entry-header, .entry-title, h3.entry-header, h1');
    const txt = txtEl ? txtEl.innerText.trim() : "";
    if (!txt) m.push("記事タイトル");

    // 3. 画像設置チェック（本文内に画像が1枚以上あるか）
    const firstImg = mainContent.querySelector('img');
    if (!firstImg) {
      m.push("画像設置（本文内に画像が見つかりません）");
    }

    // 4. タイトル地名チェック
    if (txt && (/^(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/.test(txt) || /^.{1,5}[市区町村]/.test(txt))) {
      l.push("タイトル異常: 先頭が地名（「" + txt.substring(0,8) + "…」）");
    }

    const pageText = document.body.innerText || "";
    const fullHtml = document.body.innerHTML || "";

    // 5. カテゴリチェック
    if (!pageText.includes("カテゴリ") || pageText.includes("カテゴリ：未分類") || pageText.includes("カテゴリー：未分類")) {
      m.push("カテゴリ（設定なしまたは未分類）");
    }

    // 6. 必須要素 ＆ Googleマップピンチェック
    r.forEach(i => {
      if (i === "Googleマップ") {
        if (!pageText.includes("Googleマップ") && !gmapIframe && !gmapAnchor) {
          m.push("Googleマップ（埋め込み・リンク・記述なし）");
        } else if ((gmapIframe || gmapAnchor) && !hasMapPin(mapUrl)) {
          m.push("Googleマップ（要素はあるがピン・地点が指定されていません）");
        }
      } else {
        if (!pageText.includes(i)) m.push(i);
      }
    });

    // 7. 画像キャプション検出
    const captions = Array.from(mainContent.querySelectorAll('figcaption, .caption, .wp-caption-text')).filter(c => c.innerText.trim() !== "");
    if (captions.length > 0) {
      l.push("画像キャプション検出: 本文内の画像にキャプション（注記テキスト）が " + captions.length + " 件入力されています");
    }

    // 8. AIコンテキストコード混入チェック
    if (/cit_[a-zA-Z0-9_-]{5,}/.test(fullHtml) || /data-cit/.test(fullHtml) || /googleapis\.com\/v[0-9]/.test(fullHtml) || /citation/.test(fullHtml)) {
      l.push("AIコンテキストコード混入: 「cit_...」等の出典コード・属性が検出されました");
    }

    // 9. AI不適切回答チェック
    const mainText = mainContent.innerText || "";
    const aiPatterns = ["入力されています", "入力情報では", "入力されていません", "入力情報"];
    let foundAiWords = [];
    aiPatterns.forEach(pattern => {
      if (mainText.includes(pattern)) {
        foundAiWords.push(pattern);
      }
    });
    if (foundAiWords.length > 0) {
      l.push("AI異常文言検出: 本文/Q&A内に「" + foundAiWords.join("」「") + "」が含まれています");
    }

    // 10. 各エリアからのURLピンポイント抽出（店舗情報・編集部コメント・マップ）
    let targetUrls = [];

    // ① 店舗情報一覧エリアのURL
    let shopInfoUrl = null;
    const headings = Array.from(mainContent.querySelectorAll('h1, h2, h3, h4, h5, h6, div, p'));
    let shopHeader = headings.find(el => el.children.length === 0 && el.innerText.trim().includes('店舗情報一覧'));
    if (shopHeader) {
      let cur = shopHeader.nextElementSibling;
      while (cur) {
        if (['h1','h2','h3'].includes(cur.tagName.toLowerCase()) || cur.innerText.includes('まとめ')) break;
        const link = cur.querySelector('a[href]');
        if (link) {
          const h = link.getAttribute('href');
          if (h && !h.startsWith('#') && !h.includes('maps.google.com')) { shopInfoUrl = h; break; }
        }
        cur = cur.nextElementSibling;
      }
    }

    // ② 編集部コメントエリアのURL
    let editorCommentHeader = headings.find(el => el.children.length === 0 && el.innerText.trim() === '編集部コメント');
    let editorUrlsSet = new Set();
    if (editorCommentHeader) {
      let cur = editorCommentHeader.nextElementSibling;
      while (cur) {
        const tag = cur.tagName.toLowerCase();
        if (['h1','h2','h3'].includes(tag) || cur.innerText.includes('Googleマップ')) break;
        cur.querySelectorAll('a[href]').forEach(a => {
          const h = a.getAttribute('href');
          if (h && !h.startsWith('#') && !h.includes('maps.google.com')) editorUrlsSet.add(h);
        });
        cur = cur.nextElementSibling;
      }
      if (editorUrlsSet.size >= 2) {
        l.push("編集部コメント内複数URL異常: 異なるリンク先が " + editorUrlsSet.size + " 件設定されています");
      }
    }

    // URLリストの組み立て
    if (shopInfoUrl) targetUrls.push({ name: "店舗情報一覧", url: shopInfoUrl });
    const firstEditorUrl = Array.from(editorUrlsSet)[0];
    if (firstEditorUrl) targetUrls.push({ name: "編集部コメント", url: firstEditorUrl });
    if (mapUrl) targetUrls.push({ name: "Googleマップ", url: mapUrl });

    // 結果出力メッセージ
    let msg = "【ココログ 判定結果】\n\n";
    if (m.length === 0 && l.length === 0) {
      msg += "✅ 問題なし（全項目・画像設置・AIコード・重複リンク等 正常）\n";
    } else {
      msg += "❌ 要修正\n";
      if (m.length > 0) msg += "\n■ 不足要素:\n・" + m.join("\n・") + "\n";
      if (l.length > 0) msg += "\n■ 異常検出:\n・" + l.join("\n・") + "\n";
    }

    msg += "\n----------------------------------------\n";
    if (targetUrls.length > 0) {
      msg += "【確認対象URL（" + targetUrls.length + "件）】\n" + targetUrls.map(item
