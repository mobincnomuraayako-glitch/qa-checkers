(function(){
  try {
    const r = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
    let m = [], l = [];
    
    const mainContent = document.querySelector('.entry-content, .post-content, .article-body, .entry-body') || document.body;
    
    // 1. Googleマップ要素の検出（WP前提：iframe固定）
    const gmapIframe = mainContent.querySelector('iframe[src*="google.com/maps"], iframe[src*="maps.google"]');
    let mapUrl = gmapIframe ? (gmapIframe.getAttribute('src') || "") : "";

    function hasMapPin(url) {
      if (!url) return false;
      return /[?&](q|query|cid)=/.test(url) || /!3d[-0-9.]*!4d[-0-9.]*/.test(url) || url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps');
    }

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
        if (!pageText.includes("Googleマップ") && !mapUrl) {
          m.push("Googleマップ（埋め込み・記述なし）");
        } else if (mapUrl && !hasMapPin(mapUrl)) {
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

    // ----------------------------------------------------
    // 10. URL抽出 (店舗URL×2 + Gマップiframe×1)
    // ----------------------------------------------------
    let targetUrls = [];

    // ① 店舗情報一覧エリアのURL（1個目）
    let shopInfoUrl = null;
    const allEls = Array.from(mainContent.querySelectorAll('*'));
    let shopEl = allEls.find(el => el.children.length === 0 && el.innerText && el.innerText.trim().includes('店舗情報一覧'));
    if (shopEl) {
      let cur = shopEl.closest('h1,h2,h3,h4,div,section') || shopEl;
      while (cur && cur !== mainContent) {
        let p = cur.nextElementSibling || cur.parentElement;
        if (p) {
          const aList = Array.from(p.querySelectorAll('a[href]'));
          if (p.tagName === 'A') aList.unshift(p);
          for (let a of aList) {
            const h = a.getAttribute('href');
            if (h && !h.startsWith('#') && !h.includes('google.com/maps')) {
              shopInfoUrl = h.trim();
              break;
            }
          }
        }
        if (shopInfoUrl) break;
        cur = cur.nextElementSibling;
      }
    }

    // ② 編集部コメントエリアのURL（2個目：mshots型カード＋HTML解析対応）
    let editorCommentUrl = null;
    let editorEl = allEls.find(el => el.children.length === 0 && el.innerText && el.innerText.trim().includes('編集部コメント'));

    if (editorEl) {
      // 編集部コメントより下にある「blogcard」コンテナを取得
      const blogcards = Array.from(mainContent.querySelectorAll('.blogcard, .external-blogcard, [class*="blogcard"]'));
      let targetCard = blogcards.find(card => editorEl.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING);

      if (targetCard) {
        // パターンA: 通常の <a> タグから抽出
        const aTag = targetCard.querySelector('a[href]');
        if (aTag && !aTag.getAttribute('href').includes('google.com/maps')) {
          editorCommentUrl = aTag.getAttribute('href').trim();
        }

        // パターンB: mshots（サムネイルAPI画像）のsrcから埋め込みURLをデコードして抽出
        if (!editorCommentUrl) {
          const img = targetCard.querySelector('img[src*="mshots"]');
          if (img) {
            const src = img.getAttribute('src');
            const match = src.match(/mshots\/v1\/([^?\s]+)/);
            if (match && match[1]) {
              editorCommentUrl = decodeURIComponent(match[1]).trim();
            }
          }
        }

        // パターンC: カード内のHTML全文字列からURLっぽいものを強制抽出
        if (!editorCommentUrl) {
          const cardHtml = targetCard.innerHTML;
          const urlMatch = cardHtml.match(/https?%3A%2F%2F[^\s"'<>\n\r]+/i) || cardHtml.match(/https?:\/\/[^\s"'<>\n\r]+/i);
          if (urlMatch) {
            let extracted = decodeURIComponent(urlMatch[0]);
            if (!extracted.includes('s.wordpress.com') && !extracted.includes('google.com/maps')) {
              editorCommentUrl = extracted.trim();
            }
          }
        }
      }

      // パターンD: フォールバック（カードが見つからない場合の通常の探索）
      if (!editorCommentUrl) {
        const allAnchors = Array.from(mainContent.querySelectorAll('a[href]'));
        for (let a of allAnchors) {
          if (editorEl.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) {
            const h = a.getAttribute('href');
            if (h && !h.startsWith('#') && !h.includes('google.com/maps')) {
              editorCommentUrl = h.trim();
              break;
            }
          }
        }
      }
    }

    // 【URL不足判定】
    if (!shopInfoUrl) l.push("URL不足: 店舗情報一覧の店舗URL（1件目）が見つかりません");
    if (!editorCommentUrl) l.push("URL不足: 編集部コメント内の店舗URL（2件目）が見つかりません");
    if (!mapUrl) l.push("URL不足: Googleマップ（iframe）が見つかりません");

    // URLリストの組み立て
    if (shopInfoUrl) targetUrls.push({ name: "店舗情報一覧", url: shopInfoUrl });
    if (editorCommentUrl) targetUrls.push({ name: "編集部コメント", url: editorCommentUrl });
    if (mapUrl) targetUrls.push({ name: "Googleマップ", url: mapUrl });

    // 判定結果の出力
    let msg = "【WordPress WP判定結果】\n\n";
    if (m.length === 0 && l.length === 0 && targetUrls.length === 3) {
      msg += "✅ 問題なし（店舗URL 2件 ＋ Gマップ 1件 正常検出）\n";
    } else {
      msg += "❌ 要修正\n";
      if (m.length > 0) msg += "\n■ 不足要素:\n・" + m.join("\n・") + "\n";
      if (l.length > 0) msg += "\n■ 異常検出:\n・" + l.join("\n・") + "\n";
    }

    msg += "\n----------------------------------------\n";
    if (targetUrls.length > 0) {
      msg += "【確認対象URL（" + targetUrls.length + "件）】\n" + targetUrls.map(item => {
        const shortUrl = item.url.length > 45 ? item.url.substring(0, 45) + "..." : item.url;
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
