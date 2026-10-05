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
                    resultsSummary.push(`❌ 取得失敗 (${targetUrl})\n--------------------`);
                    continue;
                }
            }

            var mainContent = doc.querySelector('div.entry-content.cf[itemprop="mainEntityOfPage"], .entry-content.cf, .entry-content, .post-content, .article-body, .entry-body') || doc.body;
            var body = doc.body;
            txt = body ? body.innerText : "";
            html = body ? body.innerHTML : "";
            var titleEl = doc.querySelector('.entry-title, h1.post-title, h1');
            titleText = titleEl ? titleEl.innerText.trim() : "（タイトル取得できず）";

            var metaPub = doc.querySelector('meta[property="article:published_time"], meta[property="og:article:published_time"], meta[name="pubdate"], meta[name="date"], meta[itemprop="datePublished"]');
            var timeEl = doc.querySelector('time.published, time.entry-date, time[datetime], .date, .post-date, .published');
            
            if (metaPub && metaPub.getAttribute('content')) {
                dateStr = metaPub.getAttribute('content').replace('T', ' ').substring(0, 19);
            } else if (timeEl) {
                dateStr = (timeEl.getAttribute('datetime') || timeEl.innerText).trim().substring(0, 19);
            }

            if (!titleEl) m.push("記事タイトル");
            if (!doc.querySelector('.post-thumbnail img, .eyecatch img, header img, .wp-post-image, .attachment-post-thumbnail')) m.push("アイキャッチ画像");

            for (var i = 0; i < prefs.length; i++) {
                if (titleText.indexOf(prefs[i]) === 0) {
                    l.push("タイトル先頭地名(" + prefs[i] + ")");
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
            if (/cit_[a-zA-Z0-9_-]{5,}|data-cit|googleapis\.com\/v[0-9]|citation/.test(html)) l.push("AIコード混入");
            if (txt.includes("入力されています") || txt.includes("入力情報では") || txt.includes("「-」と入力")) l.push("AI不自然文言");

            var halfWidthKatakanaPattern = /[\uFF61-\uFF9F]/;
            if (halfWidthKatakanaPattern.test(titleText) || halfWidthKatakanaPattern.test(mainContent.innerText)) {
                l.push("半角カタカナ混入");
            }

            var areaKeywords = ["対応エリア", "出張可能エリア", "出張エリア", "対象エリア"];
            var hasAreaMention = areaKeywords.some(function(kw) { return txt.includes(kw); });
            if (hasAreaMention) {
                var banchiPattern = /\d+[\-−ー\d]+|\d+丁目|\d+番地?|\d+号/;
                if (banchiPattern.test(txt)) {
                    l.push("店舗ありなのに対応エリア記載");
                }
            }

            var gmap = doc.querySelector('iframe[src*="google.com/maps"], iframe[src*="maps.google"]');
            var mapUrl = gmap ? (gmap.getAttribute('src') || "") : "";
            if (mapUrl) targetUrls.push({ name: "Gmap", url: mapUrl });

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

            if (shopInfoUrl) targetUrls.push({ name: "店舗情報", url: shopInfoUrl });
            if (editorCommentUrl) targetUrls.push({ name: "編集部", url: editorCommentUrl });

            // 完全にURLを省き、タイトルと日時・ステータス・リンクのみを綺麗に並べる
            var pageResult = `📌 【${titleText}】\n📅 日時: ${dateStr}\n`;
            if (m.length === 0 && l.length === 0) {
                pageResult += "✅ ステータス: チェックOK\n";
            } else {
                if (m.length > 0) pageResult += "❌ 不足: " + m.join(", ") + "\n";
                if (l.length > 0) pageResult += "⚠️ 異常: " + l.join(", ") + "\n";
            }

            if (targetUrls.length > 0) {
                var linkStrs = targetUrls.map(u => `  └ [${u.name}] ${decodeURIComponent(u.url)}`).join("\n");
                pageResult += `🔗 抽出リンク:\n${linkStrs}\n`;
            } else {
                pageResult += "🔗 抽出リンク: なし\n";
            }

            resultsSummary.push(pageResult);
        }

        var modalId = "wp-checker-modal-result";
        var oldModal = document.getElementById(modalId);
        if (oldModal) oldModal.remove();

        var overlay = document.createElement('div');
        overlay.id = modalId;
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:sans-serif;";
        
        var box = document.createElement('div');
        box.style.cssText = "background:#fff;width:85%;max-width:750px;max-height:85vh;border-radius:8px;padding:20px;box-shadow:0 4px 20px rgba(0,0,0,0.3);display:flex;flex-direction:column;";
        
        var header = document.createElement('div');
        header.innerHTML = `<h3 style="margin:0 0 10px;font-size:16px;color:#333;">一括WPチェック結果（全 ${urlsToProcess.length} 件）</h3>`;
        
        var contentArea = document.createElement('div');
        contentArea.style.cssText = "flex:1;overflow-y:auto;white-space:pre-wrap;font-size:13px;line-height:1.6;color:#333;background:#f9f9f9;padding:12px;border:1px solid #ddd;border-radius:4px;";
        contentArea.innerText = resultsSummary.join("\n--------------------\n\n");
        
        var footer = document.createElement('div');
        footer.style.cssText = "margin-top:15px;text-align:right;";
        var closeBtn = document.createElement('button');
        closeBtn.innerText = "閉じる";
        closeBtn.style.cssText = "padding:8px 22px;background:#0073aa;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;";
        closeBtn.onclick = function() { overlay.remove(); };
        
        footer.appendChild(closeBtn);
        box.appendChild(header);
        box.appendChild(contentArea);
        box.appendChild(footer);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

    } catch (e) {
        alert("エラー: " + e.message);
    }
})();
