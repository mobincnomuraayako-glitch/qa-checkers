(async function(){
    try {
        function showInputModal() {
            return new Promise(function(resolve) {
                var modalId = "wp-checker-input-modal";
                var old = document.getElementById(modalId);
                if (old) old.remove();

                var overlay = document.createElement('div');
                overlay.id = modalId;
                overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:sans-serif;";
                
                var box = document.createElement('div');
                box.style.cssText = "background:#fff;width:85%;max-width:600px;border-radius:8px;padding:20px;box-shadow:0 4px 20px rgba(0,0,0,0.3);display:flex;flex-direction:column;";
                
                var header = document.createElement('h3');
                header.innerText = "WordPress記事URL一括チェック";
                header.style.cssText = "margin:0 0 10px;font-size:16px;color:#333;";
                
                var desc = document.createElement('p');
                desc.innerText = "チェックしたいURLを改行またはカンマ区切りで入力してください（未入力の場合は現在のページをチェックします）。";
                desc.style.cssText = "margin:0 0 10px;font-size:12px;color:#d9534f;line-height:1.4;font-weight:bold;white-space:pre-wrap;";

                var textarea = document.createElement('textarea');
                textarea.style.cssText = "width:100%;height:180px;padding:8px;font-size:13px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;resize:vertical;";
                textarea.placeholder = "https://example.com/post-1\nhttps://example.com/post-2";
                
                var btnArea = document.createElement('div');
                btnArea.style.cssText = "margin-top:12px;text-align:right;";
                
                var cancelBtn = document.createElement('button');
                cancelBtn.innerText = "キャンセル";
                cancelBtn.style.cssText = "padding:6px 14px;background:#ccc;color:#333;border:none;border-radius:4px;cursor:pointer;margin-right:8px;font-size:13px;";
                cancelBtn.onclick = function() {
                    overlay.remove();
                    resolve(null);
                };

                var okBtn = document.createElement('button');
                okBtn.innerText = "チェック実行";
                okBtn.style.cssText = "padding:6px 18px;background:#0073aa;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;";
                okBtn.onclick = function() {
                    var val = textarea.value;
                    overlay.remove();
                    resolve(val);
                };

                btnArea.appendChild(cancelBtn);
                btnArea.appendChild(okBtn);
                box.appendChild(header);
                box.appendChild(desc);
                box.appendChild(textarea);
                box.appendChild(btnArea);
                overlay.appendChild(box);
                document.body.appendChild(overlay);
                textarea.focus();
            });
        }

        var inputUrls = await showInputModal();
        if (inputUrls === null) return;
        
        var urlsToProcess = [];
        if (inputUrls && inputUrls.trim() !== "") {
            urlsToProcess = inputUrls.split(/[\n,]/).map(function(u){ return u.trim(); }).filter(function(u){ return u.length > 0; });
        } else {
            urlsToProcess = [window.location.href];
        }

        var resultsSummary = [];
        var r = ["基本情報", "店舗概要", "所在地・アクセス", "営業時間・定休日", "サービス", "設備", "店舗情報一覧", "まとめ", "FAQ", "編集部コメント", "Googleマップ"];
        var prefs = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"];

        function isValidStoreUrl(h) {
            if (!h) return false;
            var trimmed = h.trim();
            if (trimmed.indexOf('#') === 0 || trimmed.indexOf('javascript:') !== -1) return false;
            if (trimmed.indexOf('google.com/maps') !== -1 || trimmed.indexOf('ja.wordpress.org') !== -1 || trimmed.indexOf('wordpress.com') !== -1) return false;
            if (trimmed.indexOf('/wp-admin/') !== -1 || trimmed.indexOf('/wp-login.php') !== -1 || trimmed.indexOf('about.php') !== -1) return false;
            return true;
        }

        function generateUrlsToTry(rawUrl) {
            var list = [rawUrl];
            try {
                var decoded = decodeURIComponent(rawUrl);
                if (list.indexOf(decoded) === -1) list.push(decoded);

                var fixed = decoded.replace(/[｜|%7C\s ]+/g, '-').replace(/-+/g, '-');
                if (list.indexOf(fixed) === -1) list.push(fixed);

                try {
                    var uObj = new URL(fixed);
                    uObj.pathname = uObj.pathname.split('/').map(function(seg){
                        return encodeURIComponent(decodeURIComponent(seg));
                    }).join('/');
                    if (list.indexOf(uObj.toString()) === -1) list.push(uObj.toString());
                } catch(e) {}

                try {
                    var uObj2 = new URL(rawUrl);
                    var pParts = uObj2.pathname.split('/').filter(Boolean);
                    if (pParts.length > 0) {
                        var slug = pParts[pParts.length - 1];
                        var apiUrl = uObj2.origin + "/?rest_route=/wp/v2/posts&slug=" + encodeURIComponent(slug);
                        list.push({ type: 'rest', url: apiUrl });
                    }
                } catch(e) {}
            } catch(e) {}
            return list;
        }

        for (var i = 0; i < urlsToProcess.length; i++) {
            var targetUrl = urlsToProcess[i];
            
            if (i > 0 && i % 5 === 0) {
                await new Promise(function(resolve) { setTimeout(resolve, 1000); });
            }

            var m = [], l = [];
            var doc, html = "", txt = "", titleText = "";
            var dateStr = "日付取得できず（予約投稿または未公開の可能性）";
            var targetUrls = [];
            var decodedTargetUrl = targetUrl;
            try { decodedTargetUrl = decodeURIComponent(targetUrl); } catch(e) {}

            var urlsToTry = generateUrlsToTry(targetUrl);
            var fetchSuccess = false;
            var finalUsedUrl = targetUrl;
            var restData = null;

            for (var tIdx = 0; tIdx < urlsToTry.length; tIdx++) {
                var currentTry = urlsToTry[tIdx];
                if (targetUrl === window.location.href) {
                    doc = document.cloneNode(true);
                    fetchSuccess = true;
                    break;
                } else if (typeof currentTry === 'object' && currentTry.type === 'rest') {
                    try {
                        var apiRes = await fetch(currentTry.url);
                        if (apiRes.ok) {
                            var json = await apiRes.json();
                            if (Array.isArray(json) && json.length > 0 && json[0].link) {
                                restData = json[0];
                                var realRes = await fetch(restData.link);
                                if (realRes.ok) {
                                    var textHtml = await realRes.text();
                                    var parser = new DOMParser();
                                    doc = parser.parseFromString(textHtml, "text/html");
                                    fetchSuccess = true;
                                    finalUsedUrl = restData.link;
                                    break;
                                }
                            }
                        }
                    } catch(e) {}
                } else {
                    try {
                        var res = await fetch(currentTry);
                        if (res.ok) {
                            var textHtml = await res.text();
                            var parser = new DOMParser();
                            doc = parser.parseFromString(textHtml, "text/html");
                            fetchSuccess = true;
                            finalUsedUrl = currentTry;
                            break;
                        }
                    } catch(e) {}
                }
            }

            if (!fetchSuccess) {
                var failMsg = "[取得失敗: 404 Not Found / 予約投稿・スラッシュ崩れ]\n";
                failMsg += "■ 入力URL: " + decodedTargetUrl + "\n";
                failMsg += "■ 対策案内: このURLの記事は下書き状態か、スラッグが異なります。プレビューURL等でお試しください。\n";
                failMsg += "--------------------";
                resultsSummary.push(failMsg);
                continue;
            }

            var noiseSelectors = [
                '#wpadminbar', '#adminmenu', '#adminmenuback', '.header-container', 'header',
                '#sidebar', '.sidebar', 'aside', '.widget', '#secondary',
                '.ranking-item', '.ranking-box', '.popular-posts', '.wpp-list', '.widget_related',
                '.related-posts', '.sns-share', '.author-box', 'footer', '.footer', '#footer'
            ];
            noiseSelectors.forEach(function(sel) {
                doc.querySelectorAll(sel).forEach(function(el) { el.remove(); });
            });

            var mainContent = doc.querySelector('div.entry-content.cf[itemprop="mainEntityOfPage"], .entry-content.cf, .entry-content, .post-content, .article-body, .entry-body') || doc.body;
            var body = doc.body;
            txt = body ? body.innerText : "";
            html = body ? body.innerHTML : "";
            var titleEl = doc.querySelector('.entry-title, h1.post-title, h1');
            titleText = titleEl ? titleEl.innerText.trim() : (restData && restData.title ? restData.title.rendered : "（タイトル取得できず）");

            var metaPub = doc.querySelector('meta[property="article:published_time"], meta[property="og:article:published_time"], meta[name="pubdate"], meta[name="date"], meta[itemprop="datePublished"]');
            var timeEl = doc.querySelector('time.published, time.entry-date, time[datetime], .date, .post-date, .published');
            
            if (metaPub && metaPub.getAttribute('content')) {
                dateStr = metaPub.getAttribute('content').replace('T', ' ').substring(0, 19) + " （公開/メタ情報）";
            } else if (timeEl) {
                dateStr = (timeEl.getAttribute('datetime') || timeEl.innerText).trim().substring(0, 19) + " （タイムスタンプ検出）";
            } else if (restData && restData.date) {
                dateStr = restData.date.replace('T', ' ').substring(0, 19) + " （REST API検出）";
            } else {
                var dateMatch = txt.match(/\d{4}[\/\-年]\d{1,2}[\/\-月]\d{1,2}日?/);
                if (dateMatch) dateStr = dateMatch[0] + " （本文内テキスト）";
            }

            if (!titleEl && !restData) m.push("記事タイトル");
            if (!doc.querySelector('.post-thumbnail img, .eyecatch img, .wp-post-image, .attachment-post-thumbnail')) m.push("アイキャッチ画像");

            var hasPrefStart = false;
            for (var j = 0; j < prefs.length; j++) {
                if (titleText.indexOf(prefs[j]) === 0) {
                    hasPrefStart = true;
                    l.push("タイトル先頭地名(" + prefs[j] + ")");
                    break;
                }
            }

            var catEls = doc.querySelectorAll('.cat-label, [class*="cat-label"], a[rel="category tag"], a[href*="/category/"]');
            var catNames = [];
            catEls.forEach(function(el) {
                var cName = el.innerText.trim();
                if (cName && catNames.indexOf(cName) === -1) catNames.push(cName);
            });
            var categoryStr = catNames.length > 0 ? catNames.join(", ") : "";
            if (categoryStr === "") m.push("カテゴリ未分類");
            
            r.forEach(function(item) {
                if (item === "Googleマップ") {
                    if (txt.indexOf("Googleマップ") === -1 && !doc.querySelector('iframe[src*="google.com/maps"]')) m.push("Googleマップなし");
                } else {
                    if (txt.indexOf(item) === -1) m.push(item);
                }
            });

            var hasCaption = doc.querySelectorAll('figcaption, .wp-caption-text').length > 0;
            if (hasCaption) l.push("画像キャプション検出");
            
            var hasAiCode = /cit_[a-zA-Z0-9_-]{5,}|data-cit|googleapis\.com\/v[0-9]|citation/.test(html);
            if (hasAiCode) l.push("AIコード混入");

            var hasAiText = txt.indexOf("入力されています") !== -1 || txt.indexOf("入力情報では") !== -1 || txt.indexOf("「-」と入力") !== -1;
            if (hasAiText) l.push("AI不自然文言");

            var halfWidthKatakanaPattern = /[\uFF61-\uFF9F]/;
            if (halfWidthKatakanaPattern.test(titleText) || halfWidthKatakanaPattern.test(mainContent.innerText)) {
                l.push("半角カタカナ混入");
            }

            var gmap = doc.querySelector('iframe[src*="google.com/maps"], iframe[src*="maps.google"]');
            if (gmap) targetUrls.push({ name: "Gmap", url: gmap.getAttribute('src') || "" });

            var shopInfoUrl = null, editorCommentUrl = null;
            var allEls = Array.from(mainContent.querySelectorAll('*'));
            var shopEl = allEls.find(function(el) { return el.children.length === 0 && el.innerText && el.innerText.trim().indexOf('店舗情報一覧') !== -1; });
            if (shopEl) {
                var cur = shopEl.closest('h1,h2,h3,h4,div,section,table,tr,p') || shopEl;
                for (var step = 0; step < 5; step++) {
                    if (!cur) break;
                    var aList = Array.from(cur.querySelectorAll('a[href]'));
                    if (cur.tagName === 'A') aList.unshift(cur);
                    for (var k = 0; k < aList.length; k++) {
                        if (isValidStoreUrl(aList[k].getAttribute('href'))) {
                            shopInfoUrl = aList[k].getAttribute('href').trim();
                            break;
                        }
                    }
                    if (shopInfoUrl) break;
                    cur = cur.nextElementSibling || cur.parentElement;
                }
            }

            var editorEl = allEls.find(function(el) { return el.children.length === 0 && el.innerText && el.innerText.trim().indexOf('編集部コメント') !== -1; });
            if (editorEl) {
                var blogcards = Array.from(mainContent.querySelectorAll('.blogcard, .external-blogcard, [class*="blogcard"], .wp-block-embed'));
                var targetCard = blogcards.find(function(card) { return (editorEl.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0; });
                if (targetCard) {
                    var aTag = targetCard.querySelector('a[href]');
                    if (aTag && isValidStoreUrl(aTag.getAttribute('href'))) editorCommentUrl = aTag.getAttribute('href').trim();
                }
            }

            if (!shopInfoUrl || !editorCommentUrl) {
                var fallbackAnchors = Array.from(mainContent.querySelectorAll('a[href]')).map(function(a) { return a.getAttribute('href'); }).filter(isValidStoreUrl);
                fallbackAnchors = Array.from(new Set(fallbackAnchors));
                if (!shopInfoUrl && fallbackAnchors.length > 0) shopInfoUrl = fallbackAnchors[0];
                if (!editorCommentUrl && fallbackAnchors.length > 1) editorCommentUrl = fallbackAnchors[1];
            }

            if (shopInfoUrl) targetUrls.push({ name: "店舗情報", url: shopInfoUrl });
            if (editorCommentUrl) targetUrls.push({ name: "編集部", url: editorCommentUrl });

            var pageResult = "[対象URL (読込成功)] " + decodeURIComponent(finalUsedUrl) + "\n";
            pageResult += "[タイトル] " + titleText + "\n";
            pageResult += "[公開/予約日時] " + dateStr + "\n";
            
            if (m.length === 0 && l.length === 0) {
                pageResult += "[ステータス] チェックOK\n";
            } else {
                if (m.length > 0) pageResult += "[不足] " + m.join(", ") + "\n";
                if (l.length > 0) pageResult += "[異常] " + l.join(", ") + "\n";
            }

            pageResult += "[判定詳細]:\n";
            pageResult += "  - [タイトル頭出し(都道府県)] " + (hasPrefStart ? "[先頭に地名あり]" : "OK") + "\n";
            pageResult += "  - [カテゴリー] " + (categoryStr !== "" ? categoryStr : "[未分類]") + "\n";
            pageResult += "  - [画像キャプション] " + (hasCaption ? "[キャプション検出]" : "OK") + "\n";

            if (targetUrls.length > 0) {
                var linkStrs = targetUrls.map(function(u) { return "  - [" + u.name + "] " + decodeURIComponent(u.url); }).join("\n");
                pageResult += "[抽出リンク]:\n" + linkStrs + "\n";
            } else {
                pageResult += "[抽出リンク]: なし\n";
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
        header.innerHTML = '<h3 style="margin:0 0 10px;font-size:16px;color:#333;">一括WPチェック結果（全 ' + urlsToProcess.length + ' 件）</h3>';
        
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
