(async function(){
    try {
        // 1. 大きなテキストエリアを持つカスタム入力モーダル（20件対応＆エラーサイト入力メッセージ付き）
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
                header.innerText = "WordPress記事URL一括チェック（20件対応）";
                header.style.cssText = "margin:0 0 10px;font-size:16px;color:#333;";
                
                var desc = document.createElement('p');
                desc.innerText = "エラーサイトを入力してください。\nPlease input error your think any sites!\n\n※チェックしたいURLを改行またはカンマ区切りで20件程度まで貼り付け可能です。\n※空欄のまま実行すると、現在開いているページをチェックします。";
                desc.style.cssText = "margin:0 0 10px;font-size:12px;color:#d9534f;line-height:1.4;font-weight:bold;white-space:pre-wrap;";

                var textarea = document.createElement('textarea');
                textarea.style.cssText = "width:100%;height:180px;padding:8px;font-size:13px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;resize:vertical;";
                textarea.placeholder = "https://example.com/post-1\nhttps://example.com/post-2\n(最大20件程度まで入力可能)";
                
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

        // 2. 1件ずつ順番にフェッチ（5件ごとにウェイトを入れてサーバー負荷・ブロックを回避）
        for (var i = 0; i < urlsToProcess.length; i++) {
            var targetUrl = urlsToProcess[i];
            
            if (i > 0 && i % 5 === 0) {
                await new Promise(function(resolve) { setTimeout(resolve, 1000); });
            }

            var m = [], l = [];
            var doc, html = "", txt = "", titleText = "";
            var dateStr = "日付取得できず（予約投稿または未公開の可能性）";
            var targetUrls = [];
            var decodedTargetUrl = "";

            try {
                decodedTargetUrl = decodeURIComponent(targetUrl);
            } catch(e) {
                decodedTargetUrl = targetUrl;
            }

            if (targetUrl === window.location.href) {
                doc = document.cloneNode(true);
            } else {
                try {
                    var res = await fetch(targetUrl);
                    if (!res.ok) {
                        // 404やエラー時の救済情報を作成
                        var failMsg = "[取得失敗: HTTP " + res.status + " (404等 / 予約投稿・スラッシュ崩れの可能性)]\n";
                        failMsg += "■ 入力URL: " + decodedTargetUrl + "\n";
                        
                        // 末尾の不自然なスラッシュや文字化けを考慮した推測候補を生成
                        var cleanUrl = decodedTargetUrl.replace(/\/+$/, ''); // 末尾スラッシュ一旦削除
                        failMsg += "■ 修正・確認用候補URL: " + cleanUrl + "/\n";
                        failMsg += "--------------------";
                        resultsSummary.push(failMsg);
                        continue;
                    }
                    var textHtml = await res.text();
                    var parser = new DOMParser();
                    doc = parser.parseFromString(textHtml, "text/html");
                } catch (fetchErr) {
                    resultsSummary.push("[取得失敗: ネットワークエラー/CORS制限]\n■ URL: " + decodedTargetUrl + "\n--------------------");
                    continue;
                }
            }

            // ノイズ要素の削除
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
            titleText = titleEl ? titleEl.innerText.trim() : "（タイトル取得できず）";

            // 日時（公開日時・予約投稿日時）の取得ロジック強化
            var metaPub = doc.querySelector('meta[property="article:published_time"], meta[property="og:article:published_time"], meta[name="pubdate"], meta[name="date"], meta[itemprop="datePublished"]');
            var timeEl = doc.querySelector('time.published, time.entry-date, time[datetime], .date, .post-date, .published, .entry-date');
            
            if (metaPub && metaPub.getAttribute('content')) {
                dateStr = metaPub.getAttribute('content').replace('T', ' ').substring(0, 19) + " （公開/メタ情報）";
            } else if (timeEl) {
                dateStr = (timeEl.getAttribute('datetime') || timeEl.innerText).trim().substring(0, 19) + " （タイムスタンプ検出）";
            } else {
                // ページ内から日付っぽいパターン（YYYY-MM-DDなど）を探す簡易フォールバック
                var dateMatch = txt.match(/\d{4}[\/\-年]\d{1,2}[\/\-月]\d{1,2}日?/);
                if (dateMatch) {
                    dateStr = dateMatch[0] + " （本文内テキスト抽出）";
                }
            }

            if (!titleEl) m.push("記事タイトル");
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
                if (cName && catNames.indexOf(cName) === -1) {
                    catNames.push(cName);
                }
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
            var hasHalfKana = halfWidthKatakanaPattern.test(titleText) || halfWidthKatakanaPattern.test(mainContent.innerText);
            if (hasHalfKana) l.push("半角カタカナ混入");

            var areaKeywords = ["対応エリア", "出張可能エリア", "出張エリア", "対象エリア"];
            var hasAreaMention = areaKeywords.some(function(kw) { return txt.indexOf(kw) !== -1; });
            var banchiPattern = /\d+[\-−ー\d]+|\d+丁目|\d+番地?|\d+号/;
            if (hasAreaMention && banchiPattern.test(txt)) {
                l.push("店舗ありなのに対応エリア記載");
            }

            // リンク抽出処理
            var gmap = doc.querySelector('iframe[src*="google.com/maps"], iframe[src*="maps.google"]');
            var mapUrl = gmap ? (gmap.getAttribute('src') || "") : "";
            if (mapUrl) targetUrls.push({ name: "Gmap", url: mapUrl });

            var shopInfoUrl = null;
            var editorCommentUrl = null;
            var allEls = Array.from(mainContent.querySelectorAll('*'));
            
            var shopEl = allEls.find(function(el) { return el.children.length === 0 && el.innerText && el.innerText.trim().indexOf('店舗情報一覧') !== -1; });
            if (shopEl) {
                var cur = shopEl.closest('h1,h2,h3,h4,div,section,table,tr,p') || shopEl;
                for (var step = 0; step < 5; step++) {
                    if (!cur) break;
                    var aList = Array.from(cur.querySelectorAll('a[href]'));
                    if (cur.tagName === 'A') aList.unshift(cur);
                    for (var k = 0; k < aList.length; k++) {
                        var h = aList[k].getAttribute('href');
                        if (isValidStoreUrl(h)) {
                            shopInfoUrl = h.trim();
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
                    if (aTag && isValidStoreUrl(aTag.getAttribute('href'))) {
                        editorCommentUrl = aTag.getAttribute('href').trim();
                    }
                }
                if (!editorCommentUrl) {
                    var allAnchors = Array.from(mainContent.querySelectorAll('a[href]'));
                    for (var aIdx = 0; aIdx < allAnchors.length; aIdx++) {
                        var anchor = allAnchors[aIdx];
                        if ((editorEl.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) {
                            var h2 = anchor.getAttribute('href');
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

            // 結果文字列の構築（デコードされた正しいURLと日時を必ず明記）
            var pageResult = "[対象URL (デコード済)] " + decodedTagetUrlFix(decodedTargetUrl) + "\n";
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
            pageResult += "  - [AIコード/不自然文言] " + (hasAiCode || hasAiText ? "[検出あり]" : "OK") + "\n";
            pageResult += "  - [半角カタカナ] " + (hasHalfKana ? "[検出あり]" : "OK") + "\n";

            if (targetUrls.length > 0) {
                var linkStrs = targetUrls.map(function(u) { return "  - [" + u.name + "] " + safeDecode(u.url); }).join("\n");
                pageResult += "[抽出リンク]:\n" + linkStrs + "\n";
            } else {
                pageResult += "[抽出リンク]: なし\n";
            }

            resultsSummary.push(pageResult);
        }

        function decodedTagetUrlFix(u) {
            try { return decodeURIComponent(u); } catch(e) { return u; }
        }
        function safeDecode(u) {
            try { return decodeURIComponent(u); } catch(e) { return u; }
        }

        // 3. 結界モーダルの表示
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
