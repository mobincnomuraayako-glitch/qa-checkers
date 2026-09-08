(function(){
  try {
    const r = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
    let m = [], l = [];
    
    const mainContent = document.querySelector('.entry-content, .post-content, .article-body, .entry-body') || document.body;
    
    // 1. Googleマップ要素の検出とピン判定
    const gmapIframe = mainContent.querySelector('iframe[src*="google.com/maps"]');
    const gmapAnchor = mainContent.querySelector('a[href*="google.com/maps"], a[href*="maps.app.goo.gl"], a[href*="goo.gl/maps"]');

    function hasMapPin(url) {
      if (!url) return false;
      return /[?&](q|query|cid)=/.test(url) || /!3d[-0-9.]*!4d[-0-9.]*/.test(url) || url.includes('maps.app.goo.gl');
    }

    let mapUrl = "";
    if (gmapIframe) mapUrl = gmapIframe.getAttribute('src') || "";
    else if (gmapAnchor) mapUrl = gmapAnchor.getAttribute('href') || "";

    // 2. タイトルチェック
    const txt = document.querySelector('.entry-title, h1.post-title, h1') ? document.querySelector('.entry-title, h1.post-title, h1').innerText.trim() : "";
    if (!txt) m.push("記事タイトル");

    // 3. アイキャッチ画像チェック
    const eyecatch = document.querySelector('.post-thumbnail img, .eyecatch img, header img, .wp-post-image, .attachment-post-thumbnail');
    if (!eyecatch) {
      m.push("アイキャッチ画像（未設定または取得不可）");
    }

    // 4. タイトル地名チェック
    if (txt && (/^(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/.test(txt) || /^.{1,5}[市区町村]/.test(txt))) {
      l.push("タイトル異常: 先頭が地名（「" + txt.substring(0,8) + "…」）");
    }

    const pageText = document.body.innerText || "";
    const fullHtml = document.body.innerHTML || "";

    // 5. カテゴリチェック
    const hasCategoryEl = !!document.querySelector('.entry-categories, .cat-links, [class*="category"]');
    const hasCategoryText = pageText.includes("カテゴリ") || hasCategoryEl;
    if (!hasCategoryText || pageText.includes("カテゴリ：未分類") || pageText.includes("カテゴリ : 未分類")) {
      m.push("カテゴリ（設定なしまたは未分類）");
    }

    // 6. 必須要素チェック
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
    const captions = Array.from(mainContent.querySelectorAll('figcaption, .wp-caption-text, .wp-element-caption, .blocks-gallery-item__caption')).filter(c => c.innerText.trim() !== "");
    if (captions.length > 0) {
      l.push("画像キャプション検出: 本文内の画像にキャプションが " + captions.length + " 件入力されています");
    }

    // 8. AIコンテキストコード混入チェック
    if (/cit_[a-zA-Z0-9_-]{5,}/.test(fullHtml) || /data-cit/.test(fullHtml) || /googleapis\.com\/v[0-9]/.test(fullHtml) || /citation/.test(fullHtml)) {
      l.push("AIコンテキストコード混入: 出典コード・属性が検出されました");
    }

    // 9. AI不適切回答チェック
    let cleanMainText = (mainContent.innerText || "").replace(/0\d{1,4}-\d{1,4}-\d{3,4}/g, "");
    const aiPatterns = ["入力されています", "入力情報では", "入力されていません", "入力情報", "「-」と入力", "は「-」"];
    let foundAiWords = [];
    aiPatterns.forEach(pattern => {
      if (cleanMainText.includes(pattern)) {
        foundAiWords.push(pattern);
      }
    });
    if (foundAiWords.length > 0) {
      l.push("AI異常文言検出: 本文/Q&A内に「" + Array.from(new Set(foundAiWords)).join("」「") + "」が含まれています");
    }

    // 10. 各エリアからのURL抽出 ＆ 生URL・ダブり判定
    let targetUrls = [];

    // ① 店舗情報一覧エリア
    let shopInfoUrl = null;
    const allElements = Array.from(mainContent.querySelectorAll('*'));
    let shopHeader = allElements.find(el => ['H1','H2','H3','H4','H5','H6'].includes(el.tagName) && el.innerText.trim().includes('店舗情報一覧'));
    if (shopHeader) {
      let cur = shopHeader.nextElementSibling;
      while (cur) {
        if (['H1','H2','H3'].includes(cur.tagName) || cur.innerText.includes('まとめ')) break;
        const link = cur.querySelector('a[href]');
        if (link) {
          const h = link.getAttribute('href');
          if (h && !h.startsWith('#') && !h.includes('google.com/maps')) { shopInfoUrl = h; break; }
        }
        cur = cur.nextElementSibling;
      }
    }

    // ② 編集部コメントエリア（見出しタグから確実に領域を取得）
    let editorUrlsSet = new Set();
    let editorHeader = allElements.find(el => ['H1','H2','H3','H4','H5','H6','DIV','P'].includes(el.tagName) && el.innerText.trim() === '編集部コメント');

    if (editorHeader) {
      let cur = editorHeader.nextElementSibling;
      let combinedHtml = "";
      let combinedText = "";

      while (cur) {
        const text = cur.innerText || "";
        const tag = cur.tagName;
        if (['H1','H2','H3'].includes(tag) || text.includes('Googleマップ')) break;

        combinedHtml += cur.innerHTML + " ";
        combinedText += text + " ";

        // <a>タグのURLを収集
        cur.querySelectorAll('a[href]').forEach(a => {
          const h = a.getAttribute('href');
          if (h && !h.startsWith('#') && !h.includes('google.com/maps')) {
            editorUrlsSet.add(h.trim());
          }
        });

        cur = cur.nextElementSibling;
      }

      // <a>タグ除去後の生のテキストからURL文字列（https://...）があるかチェック
      const pureTextNoLinks = combinedHtml.replace(/<a[\s\S]*?<\/a>/gi, '');
      const rawMatches = pureTextNoLinks.match(/https?:\/\/[^\s\)\>\]"'＜＞「」\n\r]+/g);

      if (rawMatches && rawMatches.length > 0) {
        l.push("編集部コメント内生URL露出: リンク化されていない 「(https://...)」 テキストが露出しています");
        rawMatches.forEach(url => editorUrlsSet.add(url.trim()));
      }

      if (editorUrlsSet.size >= 2 || (rawMatches && rawMatches.length > 0 && editorUrlsSet.size >= 1)) {
        l.push("編集部コメント内重複異常: ブログカードと生URLテキストの両方が挿入されています");
      }
    } else {
      // 見出しが見つからない場合のフォールバック（画面全体から「(https://...)」のテキスト直書きを判定）
      if (/\(https?:\/\/[^\)]+\)/.test(pageText)) {
        l.push("本文内生URL検出: リンク化されていないカッコ書きURL 「(https://...)」 が見つかりました");
      }
    }

    // URLリストの組み立て
    if (shopInfoUrl) targetUrls.push({ name: "店舗情報一覧", url: shopInfoUrl });
    const firstEditorUrl = Array.from(editorUrlsSet)[0];
    if (firstEditorUrl) targetUrls.push({ name: "編集部コメント", url: firstEditorUrl });
    if (mapUrl) targetUrls.push({ name: "Googleマップ", url: mapUrl });

    // 結果出力メッセージ（長いURLは簡略化表示）
    let msg = "【WordPress WP判定結果】\n\n";
    if (m.length === 0 && l.length === 0) {
      msg += "✅ 問題なし（全項目・アイキャッチ・AIコード・重複リンク等 正常）\n";
    } else {
      msg += "❌ 要修正\n";
      if (m.length > 0) msg += "\n■ 不足要素:\n・" + m.join("\n・") + "\n";
      if (l.length > 0) msg += "\n■ 異常検出:\n・" + l.join("\n・") + "\n";
    }

    msg += "\n----------------------------------------\n";
    if (targetUrls.length > 0) {
      msg += "【確認対象URL（" + targetUrls.length + "件）】\n" + targetUrls.map(item => {
        const shortUrl = item.url.length > 40 ? item.url.substring(0, 40) + "..." : item.url;
        return "・[" + item.name + "] " + shortUrl;
      }).join("\n");
    } else {
      msg += "【確認対象URL】\n・なし";
    }

    alert(msg);

    // 一括展開
    if (targetUrls.length > 0 && confirm("確認対象のURL（" + targetUrls.length + "件）をすべて別タブで開きますか？")) {
      setTimeout(() => {
        targetUrls.forEach(item => {
          window.open(item.url, '_blank');
        });
      }, 100);
    }

  } catch(err) {
    alert("実行時エラー: " + err.message);
  }
})();
