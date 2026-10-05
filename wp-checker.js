(async function(){
    try {
        // 1. ユーザーにチェックしたいURLのリスト（カンマ区切りまたは改行区切り）を入力してもらう
        var inputUrls = prompt("チェックしたいWordPress記事のURLを貼り付けてください（複数ある場合は改行またはカンマ区切り）：\n※現在開いているページをチェックしたい場合は、何も入力せずOKを押してください。");
        
        var urlsToProcess = [];
        if (inputUrls && inputUrls.trim() !== "") {
            urlsToProcess = inputUrls.split(/[\n,]/).map(u => u.trim()).filter(u => u.length > 0);
        } else {
            urlsToProcess = [window.location.href];
        }

        var resultsSummary = [];
        
        // 2. 必須見出しの定義
        var r = ["基本情報", "店舗概要", "所在地・アクセス", "営業時間・定休日", "サービス", "設備", "店舗情報一覧", "まとめ", "FAQ", "編集部コメント", "Googleマップ"];
        var prefs = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"];

        // 3. 各URLを順番に取得してチェックを実行
        for (let targetUrl of urlsToProcess) {
            var m = [], l = [];
            var doc, html = "", txt = "", titleText = "";
            var dateStr = "取得できず";
            var targetUrls = [];

            if (targetUrl === window.location.href) {
                // 現在のページの場合
                doc = document;
            } else {
                // 外部URLの場合はfetchでHTMLを取得してパース
                try {
                    let res = await fetch(targetUrl);
                    let textHtml = await res.text();
                    let parser = new DOMParser();
                    doc = parser.parseFromString(textHtml, "text/html");
                } catch (fetchErr) {
                    resultsSummary.push(`【${targetUrl}】\n❌ 取得失敗: ${fetchErr.message}\n--------------------`);
                    continue;
                }
            }

            var mainContent = doc.querySelector('div.entry-content.cf[itemprop="mainEntityOfPage"], .entry-content.cf, .entry-content, .post-content, .article-body, .entry-body') || doc.body;
            var body = doc.body;
            txt = body ? body.innerText : "";
            html = body ? body.innerHTML : "";
            var titleEl = doc.querySelector('.entry-title, h1.post-title, h1');
            titleText = titleEl ? titleEl.innerText.trim() : "";

            // チェック項目1: タイトル・アイキャッチ
            if (!titleText) m.push("記事タイトル");
            if (!doc.querySelector('.post-thumbnail img, .eyecatch img, header img, .wp-post-image, .attachment-post-thumbnail')) m.push("アイキャッチ画像");

            // チェック項目2: 地名スタート
            for (var i = 0; i < prefs.length; i++) {
                if (titleText.indexOf(prefs[i]) === 0) {
                    l.push("タイトル異常: 先頭が地名(" + prefs[i] + ")");
                    break;
                }
            }

            // チェック項目3: カテゴリ・見出し
            if (!txt.includes("カテゴリ") && !doc.querySelector('.entry-categories, .cat-links, [class*="category"]')) m.push("カテゴリ未分類");
            
            r.forEach(function(item) {
                if (item === "Googleマップ") {
                    if (!txt.includes("Googleマップ") && !doc.querySelector('iframe[src*="google.com/maps"]')) m.push("Googleマップなし");
                } else {
                    if (!txt.includes(item)) m.push(item);
                }
            });

            // チェック項目4: キャプション・AIコード・不自然な文言
            if (doc.querySelectorAll('figcaption, .wp-caption-text').length > 0) l.push("画像キャプション検出");
            if (/cit_[a-zA-Z0-9_-]{5,}|data-cit|googleapis\.com\/v[0-9]|citation/.test(html)) l.push("AIコンテキストコード混入");
            if (txt.includes("入力されています") || txt.includes("入力情報では") || txt.includes("「-」と入力")) l.push("AI特有の不自然な文言");

            // チェック項目5: 半角カタカナ
            var halfWidthKatakanaPattern = /[\uFF61-\uFF9F]/;
            if (halfWidthKatakanaPattern.test(titleText) || halfWidthKatakanaPattern.test(mainContent.innerText)) {
                l.push("半角カタカナの混入検知 (文字消失リスクあり)");
            }

            // チェック項目6: 番地記載の整合性
            var areaKeywords = ["対応エリア", "出張可能エリア", "出張エリア", "対象エリア"];
            var hasAreaMention = areaKeywords.some(function(kw) { return txt.includes(kw); });
            if (hasAreaMention) {
                var banchiPattern = /\d+[\-−ー\d]+|\d+丁目|\d+番地?|\d+号/;
                if (banchiPattern.test(txt)) {
                    l.push("店舗あり(番地記載あり)のため対応エリア等の記載不可");
                }
            }

            // 結果の文字列まとめ
            var pageResult = `📄 URL: ${targetUrl}\n`;
            if (m.length === 0 && l.length === 0) {
                pageResult += "✅ チェックOK！\n";
            } else {
                if (m.length > 0) pageResult += "❌ 不足:\n・" + m.join("\n・") + "\n";
                if (l.length > 0) pageResult += "⚠️ 異常:\n・" + l.join("\n・") + "\n";
            }
            resultsSummary.push(pageResult + "--------------------");
        }

        // 4. まとめて結果を表示
        alert("【一括WPチェック結果（全 " + urlsToProcess.length + " 件）】\n\n" + resultsSummary.join("\n"));

    } catch (e) {
        alert("エラー: " + e.message);
    }
})();
