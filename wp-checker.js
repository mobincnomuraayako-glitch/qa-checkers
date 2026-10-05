(async function(){
    try {
        var inputUrls = prompt("チェックしたいWordPress記事のURLを貼り付けてください（複数ある場合は改行またはカンマ区切り）：\n※現在開いているページをチェックしたい場合は、何も入力せずOKを押してください。");
        
        var urlsToProcess = [];
        if (inputUrls && inputUrls.trim() !== "") {
            urlsToProcess = inputUrls.split(/[\n,]/).map(u => u.trim()).filter(u => u.length > 0);
        } else {
            urlsToProcess = [window.location.href];
        }

        var resultsSummary = [];
        var r = ["基本情報", "店舗概要", "所在地・アクセス", "営業時間・定休日", "サービス", "設備", "店舗情報一覧", "まとめ", "FAQ", "編集部コメント", "Googleマップ"];
        var prefs = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"];

        // 外部URLの店舗リンク検証用関数
        function isValidStoreUrl(h) {
            if (!h) return false;
            var trimmed = h.trim();
            if (trimmed.startsWith('#') || trimmed.includes('javascript:')) return false;
            if (trimmed.includes('google.com/maps') || trimmed.includes('ja.wordpress.org') || trimmed.includes('wordpress.com')) return false;
            if (trimmed.includes('/wp-admin/') || trimmed.includes('/wp-login.php') || trimmed.includes('about.php')) return false;
            if (trimmed.includes('btj-romance-lab.com') && (trimmed.includes('/wp-admin') || trimmed.includes('about.php') || trimmed.includes('/local-guide/'))) return false;
            return true;
        }

        for (let targetUrl of urlsToProcess) {
            var m = [], l = [];
            var doc, html = "", txt = "", titleText = "";
            var dateStr = "日付取得できず";
            var targetUrls = [];

            if (targetUrl === window.location.href) {
                doc = document;
            } else {
                try {
                    let res = await fetch(targetUrl);
                    let textHtml = await res.text();
                    let parser = new DOMParser();
                    doc = parser.parseFromString(textHtml, "text/html");
                } catch (fetchErr) {
                    resultsSummary.push(`📄 URL: ${targetUrl}\n❌ 取得失敗: ${fetchErr.message}\n--------------------`);
                    continue;
                }
            }

            var mainContent = doc.querySelector('div.entry-content.cf[itemprop="mainEntityOfPage"], .entry-content.cf, .entry-content, .post-content, .article-body, .entry-body') || doc.body;
            var body = doc.body;
            txt = body ? body.innerText : "";
            html = body ? body.innerHTML : "";
            var titleEl = doc.querySelector('.entry-title, h1.post-title, h1');
            titleText = titleEl ? titleEl.innerText.trim() : "";

            // --- 日時の網羅的取得（公開日・予約投稿日時） ---
            var metaPub = doc.querySelector('meta[property="article:published_time"], meta[property="og:article:published_time"], meta[name="pubdate"], meta[name="date"], meta[itemprop="datePublished"]');
            var timeEl = doc.querySelector('time.published, time.entry-date, time[datetime], .date, .post-date, .published');
            
            if (metaPub && metaPub.getAttribute('content')) {
                dateStr = metaPub.getAttribute('content').replace('T', ' ').substring(0, 19);
            } else if (timeEl) {
                dateStr = (timeEl.getAttribute('datetime') || timeEl.innerText).trim().substring(0, 19);
            }

            // --- 各種チェック項目 ---
            if (!titleText) m.push("記事タイトル");
            if (!doc.querySelector('.post-thumbnail img, .eyecatch img, header img, .wp-post-image, .attachment-post-thumbnail')) m.push("アイキャッチ画像");

            for (var i = 0; i < prefs.length; i++) {
                if (titleText.indexOf(prefs[i]) === 0) {
                    l.push("タイトル異常: 先頭が地名(" + prefs[i] + ")");
                    break;
                }
            }

            if (!txt.includes("カテゴリ") && !doc.querySelector('.entry-categories, .cat-links, [class*="category"]')) m.push("カテゴリ未分類");
            
            r.forEach(function(item) {
                if (item === "Googleマップ") {
                    if (!txt.includes("Googleマップ") && !doc.querySelector('iframe[src*="google.com/maps"]')) m.push("Googleマップなし");
                } else {
                    if (!txt.includes(item)) m.push(item);
                }
            });

            if (doc.querySelectorAll('figcaption, .wp-caption-text').length > 0) l.push("画像キャプション検出");
            if (/cit_[a-zA-Z0-9_-]{5,}|data-cit|googleapis\.com\/v[0-9]|citation/.test(html)) l.push("AIコンテキストコード混入");
            if (txt.includes("入力されています") || txt.includes("入力情報では") || txt.includes("「-」と入力")) l.push("AI特有の不自然な文言");

            var halfWidthKatakanaPattern = /[\uFF61-\uFF9F]/;
            if (halfWidthKatakanaPattern.test(titleText) || halfWidthKatakanaPattern.test(mainContent.innerText)) {
                l.push("半角カタカナの混入検知 (文字消失リスクあり)");
            }

            var areaKeywords = ["対応エリア", "出張可能エリア", "出張エリア", "対象エリア"];
            var hasAreaMention = areaKeywords.some(function(kw) { return txt.includes(kw); });
            if (hasAreaMention) {
                var banchiPattern = /\d+[\-−ー\d]+|\d+丁目|\d+番地?|\d+号/;
                if (banchiPattern.test(txt)) {
                    l.push("店舗あり(番地記載あり)のため対応エリア等の記載不可");
                }
            }

            // --- 【復活】確認対象URL（Googleマップ・店舗情報・編集部コメント）の抽出 ---
            var gmap = doc.querySelector('iframe[src*="google.com/maps"], iframe[src*="maps.google"]');
            var mapUrl = gmap ? (gmap.getAttribute('src') || "") : "";
            if (mapUrl) targetUrls.push({ name: "Googleマップ", url: mapUrl });

            var shopInfoUrl = null;
            var editorCommentUrl = null;
            var allEls = Array.from(mainContent.querySelectorAll('*'));
            
            var shopEl = allEls.find(function(el) { return el.children.length === 0 && el.innerText && el.innerText.trim().includes('店舗情報一覧'); });
            if (shopEl) {
                var cur = shopEl.closest('h1,h2,h3,h4,div,section,table,tr,p') || shopEl;
                for (let step = 0; step < 5; step++) {
                    if (!cur) break;
                    var aList = Array.from(cur.querySelectorAll('a[href]'));
                    if (cur.tagName === 'A') aList.unshift(cur);
                    for (var a of aList) {
                        var h = a.getAttribute('href');
                        if (isValidStoreUrl(h)) {
                            shopInfoUrl = h.trim();
                            break;
                        }
                    }
                    if (shopInfoUrl) break;
                    cur = cur.nextElementSibling || cur.parentElement;
                }
            }

            var editorEl = allEls.find(function(el) { return el.children.length === 0 && el.innerText && el.innerText.trim().includes('編集部コメント'); });
            if (editorEl) {
                var blogcards = Array.from(mainContent.querySelectorAll('.blogcard, .external-blogcard, [class*="blogcard"], .wp-block-embed'));
                var targetCard = blogcards.find(function(card) { return editorEl.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING; });
                if (targetCard) {
                    var aTag = targetCard.querySelector('a[href]');
                    if (aTag && isValidStoreUrl(aTag.getAttribute('href'))) {
                        editorCommentUrl = aTag.getAttribute('href').trim();
                    }
                }
                if (!editorCommentUrl) {
                    var allAnchors = Array.from(mainContent.querySelectorAll('a[href]'));
                    for (var a of allAnchors) {
                        if (editorEl.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) {
                            var h2 = a.getAttribute('href');
                            if (isValidStoreUrl(h2)) {
                                editorCommentUrl = h2.trim();
                                break;
                            }
                        }
                    }
                }
            }

            if (!shopInfoUrl || !editorCommentUrl) {
                var fallbackAnchors = Array.from(mainContent.querySelectorAll('a[href]')).map(function(a) { return a.getAttribute('href'); }).filter(isValidStoreUrl);
                fallbackAnchors = Array.from(new Set(fallbackAnchors));
                if (!shopInfoUrl && fallbackAnchors.length > 0) {
                    shopInfoUrl = fallbackAnchors[0];
                }
                if (!editorCommentUrl && fallbackAnchors.length > 1) {
                    editorCommentUrl = fallbackAnchors.find(function(u) { return u !== shopInfoUrl; }) || fallbackAnchors[fallbackAnchors.length - 1];
                } else if (!editorCommentUrl && fallbackAnchors.length === 1) {
                    editorCommentUrl = fallbackAnchors[0];
                }
            }

            if (shopInfoUrl) targetUrls.push({ name: "店舗情報一覧", url: shopInfoUrl });
            if (editorCommentUrl) targetUrls.push({ name: "編集部コメント", url: editorCommentUrl });

            // --- 結果の組み立て ---
            var pageResult = `📄 URL: ${targetUrl}\n📅 日時: ${dateStr}\n`;
            if (m.length === 0 && l.length === 0) {
                pageResult += "✅ ステータス: チェックOK！\n";
            } else {
                if (m.length > 0) pageResult += "❌ 不足:\n・" + m.join("\n・") + "\n";
                if (l.length > 0) pageResult += "⚠️ 異常:\n・" + l.join("\n・") + "\n";
            }

            if (targetUrls.length > 0) {
                pageResult += "🔗 抽出URL (" + targetUrls.length + "件):\n";
                targetUrls.forEach(function(u) {
                    pageResult += "   ・[" + u.name + "] " + u.url + "\n";
                });
            } else {
                pageResult += "🔗 抽出URL: なし\n";
            }

            resultsSummary.push(pageResult + "--------------------");
        }

        alert("【一括WPチェック結果（全 " + urlsToProcess.length + " 件）】\n\n" + resultsSummary.join("\n"));

    } catch (e) {
        alert("エラー: " + e.message);
    }
})();
