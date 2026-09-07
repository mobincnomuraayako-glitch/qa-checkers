(function(){
  try {
    const r = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
    let m = [], l = [];
    
    const mainContent = document.querySelector('.entry-content, .post-content, .article-body, .entry-body') || document.body;
    
    // 1. 本文内リンクの抽出（重複排除しない）
    const allLinks = Array.from(mainContent.querySelectorAll('a')).filter(a => {
      const h = a.getAttribute('href');
      if (!h || h.startsWith('#') || h.startsWith('javascript:') || h.startsWith('mailto:') || h.startsWith('tel:')) return false;
      if (a.closest('header, footer, nav, aside, #wpadminbar, .sidebar, .widget, .entry-categories, .cat-links, .entry-meta, .related-posts, .post-navigation, .breadcrumb')) return false;
      return true;
    });

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
        const hasGmapText = pageText.includes("Googleマップ");
        const hasGmapIframe = !!mainContent.querySelector('iframe[src*="google.com/maps"]');
        const hasGmapUrl = /https?:\/\/(goo\.gl\/maps|maps\.app\.goo\.gl|www\.google\.[a-z]+\/maps)/.test(fullHtml);
        if (!hasGmapText && !hasGmapIframe && !hasGmapUrl) {
          m.push("Googleマップ（埋め込み・リンク・記述なし）");
        }
      } else {
        if (!pageText.includes(i)) m.push(i);
      }
    });

    // 7. 画像キャプション検出
    const captions = Array.from(mainContent.querySelectorAll('figcaption, .wp-caption-text, .wp-element-caption, .blocks-gallery-item__caption')).filter(c => c.innerText.trim() !== "");
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

    // 10. 編集部コメント内の複数リンクチェック（2つ以上でNG）
    const editorCommentNodes = Array.from(mainContent.querySelectorAll('*')).filter(el => {
      return el.children.length === 0 && el.innerText.includes('編集部コメント');
    });
    if (editorCommentNodes.length > 0) {
      const editorSection = editorCommentNodes[0].closest('div, section, article') || editorCommentNodes[0].parentElement;
      if (editorSection) {
        const editorLinks = editorSection.querySelectorAll('a[href]');
        if (editorLinks.length >= 2) {
          l.push("編集部コメント内重複リンク異常: リンクが " + editorLinks.length + " 件（2件以上）設定されています");
        }
      }
    }

    // 11. リンク抽出処理（重複排除なし・マップ表示用追加）
    let displayUrls = [];
    let openUrls = [];

    allLinks.forEach(a => {
      const href = a.getAttribute('href');
      if (href) {
        displayUrls.push(href);
        openUrls.push(href);
      }
    });

    // iframeのGoogleマップも検出して一覧に表示
    const gmapIframe = mainContent.querySelector('iframe[src*="google.com/maps"]');
    if (gmapIframe) {
      displayUrls.push("Googleマップ（iframe埋め込み）");
    }

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
      msg += "【検出された本文内リンク（" + displayUrls.length + "件）】\n・" + displayUrls.join("\n・");
    } else {
      msg += "【検出された本文内リンク】\n・なし";
    }

    alert(msg);

    // リンクの一括展開（web URLのみ対象）
    if (openUrls.length > 0 && confirm("検出された店舗URL（" + openUrls.length + "件）をすべて別タブで開いて確認しますか？")) {
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
