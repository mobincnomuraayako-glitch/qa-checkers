(function(){
  try {
    const r = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
    let m = [], l = [];
    
    const mainContent = document.querySelector('.entry-content, .post-content, .article-body, .entry-body') || document.body;
    
    // 1. Googleマップ要素の検出
    const gmapIframe = mainContent.querySelector('iframe[src*="google.com/maps"]');
    const gmapAnchor = mainContent.querySelector('a[href*="google.com/maps"], a[href*="maps.app.goo.gl"], a[href*="goo.gl/maps"]');

    // 2. 本文内リンクの抽出（マップ内リンク・Googleマップ用URLを完全に排除）
    const allLinks = Array.from(mainContent.querySelectorAll('a')).filter(a => {
      const h = a.getAttribute('href');
      if (!h || h.startsWith('#') || h.startsWith('javascript:') || h.startsWith('mailto:') || h.startsWith('tel:')) return false;
      
      if (a.closest('header, footer, nav, aside, #wpadminbar, .sidebar, .widget, .entry-categories, .cat-links, .entry-meta, .related-posts, .post-navigation, .breadcrumb')) return false;
      if (a.closest('iframe, [class*="map"], [id*="map"], .ggmap, .google-map')) return false;
      if (h.includes('google.com/maps') || h.includes('maps.google.com') || h.includes('goo.gl/maps') || h.includes('maps.app.goo.gl')) return false;
      
      return true;
    });

    // 3. タイトルチェック
    const txt = document.querySelector('.entry-title, h1.post-title, h1') ? document.querySelector('.entry-title, h1.post-title, h1').innerText.trim() : "";
    if (!txt) m.push("記事タイトル");

    // 4. アイキャッチ画像チェック
    const eyecatch = document.querySelector('.post-thumbnail img, .eyecatch img, header img, .wp-post-image, .attachment-post-thumbnail');
    if (!eyecatch) {
      m.push("アイキャッチ画像（未設定または取得不可）");
    }

    // 5. タイトル地名チェック
    if (txt && (/^(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/.test(txt) || /^.{1,5}[市区町村]/.test(txt))) {
      l.push("タイトル異常: 先頭が地名（「" + txt.substring(0,8) + "…」）");
    }

    const pageText = document.body.innerText || "";
    const fullHtml = document.body.innerHTML || "";

    // 6. カテゴリチェック
    const hasCategoryEl = !!document.querySelector('.entry-categories, .cat-links, [class*="category"]');
    const hasCategoryText = pageText.includes("カテゴリ") || hasCategoryEl;
    if (!hasCategoryText || pageText.includes("カテゴリ：未分類") || pageText.includes("カテゴリ : 未分類")) {
      m.push("カテゴリ（設定なしまたは未分類）");
    }

    // 7. 必須要素チェック
    r.forEach(i => {
      if (i === "Googleマップ") {
        if (!pageText.includes("Googleマップ") && !gmapIframe && !gmapAnchor) {
          m.push("Googleマップ（埋め込み・リンク・記述なし）");
        }
      } else {
        if (!pageText.includes(i)) m.push(i);
      }
    });

    // 8. 画像キャプション検出
    const captions = Array.from(mainContent.querySelectorAll('figcaption, .wp-caption-text, .wp-element-caption, .blocks-gallery-item__caption')).filter(c => c.innerText.trim() !== "");
    if (captions.length > 0) {
      l.push("画像キャプション検出: 本文内の画像にキャプション（注記テキスト）が " + captions.length + " 件入力されています");
    }

    // 9. AIコンテキストコード混入チェック
    if (/cit_[a-zA-Z0-9_-]{5,}/.test(fullHtml) || /data-cit/.test(fullHtml) || /googleapis\.com\/v[0-9]/.test(fullHtml) || /citation/.test(fullHtml)) {
      l.push("AIコンテキストコード混入: 「cit_...」等の出典コード・属性が検出されました");
    }

    // 10. AI不適切回答チェック
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

    // 11. 編集部コメント内の複数「別URL」チェック（URL単位で重複排除）
    let editorCommentHeader = null;
    const headings = Array.from(mainContent.querySelectorAll('h1, h2, h3, h4, h5, h6, div, p'));
    for (let el of headings) {
      if (el.children.length === 0 && el.innerText.trim() === '編集部コメント') {
        editorCommentHeader = el;
        break;
      }
    }

    if (editorCommentHeader) {
      let current = editorCommentHeader.nextElementSibling;
      let editorUrls = new Set(); // 一意なURLのみを保持するSet

      while (current) {
        const tag = current.tagName.toLowerCase();
        const curText = current.innerText || "";
        if (['h1','h2','h3'].includes(tag) || curText.includes('Googleマップ')) {
          break;
        }

        const linksInBlock = current.querySelectorAll('a[href]');
        linksInBlock.forEach(a => {
          const href = a.getAttribute('href');
          if (href) editorUrls.add(href);
        });

        if (tag === 'a' && current.hasAttribute('href')) {
          editorUrls.add(current.getAttribute('href'));
        }

        current = current.nextElementSibling;
      }

      // 異なるURLが「2種類以上」存在する場合のみエラー判定
      if (editorUrls.size >= 2) {
        l.push("編集部コメント内複数URL異常: 異なるリンク先が " + editorUrls.size + " 件設定されています");
      }
    }

    // 12. リンク統合処理（全体もURL単位で重複排除）
    let displayUrlsSet = new Set();
    let openUrlsSet = new Set();

    // 通常の本文リンクを追加
    allLinks.forEach(a => {
      const href = a.getAttribute('href');
      if (href) {
        displayUrlsSet.add(href);
        openUrlsSet.add(href);
      }
    });

    // Googleマップ用URLを追加
    if (gmapIframe) {
      const mapSrc = gmapIframe.getAttribute('src');
      displayUrlsSet.add("[Googleマップ] " + mapSrc);
      openUrlsSet.add(mapSrc);
    } else if (gmapAnchor) {
      const mapHref = gmapAnchor.getAttribute('href');
      displayUrlsSet.add("[Googleマップ] " + mapHref);
      openUrlsSet.add(mapHref);
    }

    const displayUrls = Array.from(displayUrlsSet);
    const openUrls = Array.from(openUrlsSet);

    // 結果出力
    let msg = "【WordPress WP判定結果】\n\n";
    if (m.length === 0 && l.length === 0) {
      msg += "✅ 問題なし（全項目・アイキャッチ・AIコード・重複リンク等 正常）\n";
    } else {
      msg += "❌ 要修正\n";
      if (m.length > 0) msg += "\n■ 不足要素:\n・" + m.join("\n・") + "\n";
      if (l.length > 0) msg += "\n■ 異常検出:\n・" + l.join("\n・") + "\n";
    }

    msg += "\n----------------------------------------\n";
    if (displayUrls.length > 0) {
      msg += "【検出されたURL（" + displayUrls.length + "件）】\n・" + displayUrls.join("\n・");
    } else {
      msg += "【検出されたURL】\n・なし";
    }

    alert(msg);

    // リンクの一括展開
    if (openUrls.length > 0 && confirm("検出されたURL（" + openUrls.length + "件）をすべて別タブで開きますか？")) {
      setTimeout(() => {
        openUrls.forEach(url => {
          window.open(url, '_blank');
        });
      }, 100);
    }

  } catch(err) {
    alert("実行時エラー: " + err.message);
  }
})();
