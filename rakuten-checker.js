// 10. 本文エリア（b）からの厳格な外部リンク抽出
    const currentUrl = location.href.split('?')[0].split('#')[0]; // 現在のページURL（パラメータ除外）
    let targetUrls = new Set();
    let targetAnchors = [];

    // URLクレンジング＆判定用関数
    const isExternalUrl = (urlStr) => {
      try {
        const u = new URL(urlStr);
        // 楽天ドメイン全般および現在見ている記事自身のURLを除外
        if (u.hostname.includes('rakuten')) return false;
        if (urlStr.startsWith(currentUrl)) return false;
        return true;
      } catch(e) { return false; }
    };

    // A: <a> タグ経由
    const anchors = Array.from(b.querySelectorAll('a'));
    anchors.forEach(a => {
      const rawHref = a.getAttribute('href') || '';
      if (!rawHref.startsWith('http://') && !rawHref.startsWith('https://')) return;
      if (isExternalUrl(rawHref)) {
        targetUrls.add(rawHref);
        targetAnchors.push(a);
      }
    });

    // B: 直書きテキスト経由（https://...）
    const rawMatches = mainText.match(/https?:\/\/[^\s\<\>"\']+/g) || [];
    rawMatches.forEach(url => {
      let clean = url.replace(/&amp;/g, '&').replace(/[\s\)\>\]]+$/, '');
      if (isExternalUrl(clean)) {
        targetUrls.add(clean);
      }
    });

    // マップ重複対策：goo.gl系と通常mapsの重複を1つに統合
    let finalUrlList = Array.from(targetUrls);
    let hasGmapApp = finalUrlList.some(u => u.includes('maps.app.goo.gl') || u.includes('goo.gl/maps'));
    if (hasGmapApp) {
      // 短縮URLがある場合は、変換後の標準URL重複を防止
      finalUrlList = finalUrlList.filter(u => !u.includes('google.com/maps/search'));
    }
