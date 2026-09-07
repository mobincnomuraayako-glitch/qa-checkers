(function(){
  try {
    // 1. メインドキュメントおよび iframe 内のドキュメントを取得
    let targetDoc = document;
    const iframes = document.querySelectorAll('iframe');
    for (let i = 0; i < iframes.length; i++) {
      try {
        if (iframes[i].contentDocument && iframes[i].contentDocument.querySelector('.entry-body, .entry-content, .entry, body')) {
          targetDoc = iframes[i].contentDocument;
          break;
        }
      } catch(e) {}
    }

    const r = ["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
    let m = [], l = [];

    const mainContent = targetDoc.querySelector('.entry-body, .entry-content, .entry') || targetDoc.body;

    // Googleマップ要素の検出
    const gmapIframe = mainContent.querySelector('iframe[src*="maps.google.com"], iframe[src*="google.com/maps"]');
    const gmapAnchor = mainContent.querySelector('a[href*="maps.google.com"], a[href*="google.com/maps"], a[href*="goo.gl/maps"]');

    function hasMapPin(url) {
      if (!url) return false;
      return /[?&](q|query|cid)=/.test(url) || /!3d[-0-9.]*!4d[-0-9.]*/.test(url) || url.includes('maps.google.com/1');
    }

    let mapUrl = "";
    if (gmapIframe) mapUrl = gmapIframe.getAttribute('src') || "";
    else if (gmapAnchor) mapUrl = gmapAnchor.getAttribute('href') || "";

    // タイトルチェック
    const txtEl = targetDoc.querySelector('.entry-header, .entry-title, h3.entry-header, h1');
    const txt = txtEl ? txtEl.innerText.trim() : "";
    if (!txt) m.push("記事タイトル");

    // 画像設置チェック
    const firstImg = mainContent.querySelector('img');
    if (!firstImg) {
      m.push("画像設置（本文内に画像が見つかりません）");
    }

    // 地名チェック
    if (txt && (/^(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/.test(txt) || /^.{1,5}[市区町村]/.test(txt))) {
      l.push("タイトル異常: 先頭が地名（「" + txt.substring(0,8) + "…」）");
    }

    const pageText = targetDoc.body ? targetDoc.body.innerText : "";
    const fullHtml = targetDoc.body ? targetDoc.body.innerHTML : "";

    // カテゴリチェック
    if (!pageText.includes("カテゴリ") || pageText.includes("カテゴリ：未分類") || pageText.includes("カテゴリー：未分類")) {
      m.push("カテゴリ（設定なしまたは未分類）");
    }

    // 必須要素チェック
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

    // AIコードチェック
    if (/cit_[a-zA-Z0-9_-]{5,}/.test(fullHtml) || /data-cit/.test(fullHtml)) {
      l.push("AIコンテキストコード混入疑い");
    }

    // 結果の出力
    let msg = "【ココログ 判定結果】\n\n";
    if (m.length === 0 && l.length === 0) {
      msg += "✅ 問題なし（全11項目・冒頭画像・カテゴリ・AIコード正常）";
    } else {
      msg += "❌ 要修正\n";
      if (m.length > 0) msg += "\n■ 不足要素:\n・" + m.join("\n・") + "\n";
      if (l.length > 0) msg += "\n■ 異常検出:\n・" + l.join("\n・") + "\n";
    }

    alert(msg);

  } catch(err) {
    alert("判定エラー: " + err.message);
  }
})();
