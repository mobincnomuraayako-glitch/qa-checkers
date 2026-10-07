(async function(){
    try {
        // ==========================================
        // 1. 入力モーダルの生成（20件一括入力対応）
        // ==========================================
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
                header.innerText = "WordPress記事URL一括チェック（自動スラッグ補正付き）";
                header.style.cssText = "margin:0 0 10px;font-size:16px;color:#333;";
                
                var desc = document.createElement('p');
                desc.innerText = "エラーサイトを入力してください。\nPlease input error your think any sites!\n\n※チェックしたいURLを改行またはカンマ区切りで20件程度まで貼り付け可能です。";
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
        
        // 入力されたテキストを改行またはカンマで分割して配列化
        var urlsToProcess = [];
        if (inputUrls && inputUrls.trim() !== "") {
            urlsToProcess = inputUrls.split(/[\n,]/).map(function(u){ return u.trim(); }).filter(function(u){ return u.length > 0; });
        } else {
            urlsToProcess = [window.location.href];
        }

        var resultsSummary = [];
        // [拡張ポイント] チェックしたい項目（不足判定の対象）を追加・編集できます
        var r = ["基本情報", "店舗概要", "所在地・アクセス", "営業時間・定休日", "サービス", "設備", "店舗情報一覧", "まとめ", "FAQ", "編集部コメント", "Googleマップ"];
        var prefs = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"];

        // 外部リンクの除外判定（WordPressの管理画面やGoogleマップ自体などを弾く）
        function isValidStoreUrl(h) {
            if (!h) return false;
            var trimmed = h.trim();
            if (trimmed.indexOf('#') === 0 || trimmed.indexOf('javascript:') !== -1) return false;
            if (trimmed.indexOf('google.com/maps') !== -1 || trimmed.indexOf('ja.wordpress.org') !== -1 || trimmed.indexOf('wordpress.com') !== -1) return false;
            if (trimmed.indexOf('/wp-admin/') !== -1 || trimmed.indexOf('/wp-login.php') !== -1 || trimmed.indexOf('about.php') !== -1) return false;
            return true;
        }

        // ==========================================
        // 2. 記号やスペースをハイフンに置換して正しいURL候補を生成
        // ==========================================
        function generateFixedUrl(rawUrl) {
            try {
                var decoded = decodeURIComponent(rawUrl);
                // 「｜」や全角スペース、通常のスペースなどをハイフンに置換
                var fixed = decoded.replace(/[｜| \s]+/g, '-');
                fixed = fixed.replace(/-+/g, '-'); // 連続するハイフンをまとめる
                return fixed;
            } catch(e) {
                return rawUrl;
            }
        }

        // ==========================================
        // 3. 1件ずつ順番にフェッチ（サーバー負荷軽減のため5件ごとにウェイト）
        // ==========================================
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
            try { decodedTargetUrl = decodeURIComponent(targetUrl); } catch(e) { decodedTargetUrl = targetUrl; }

            // 試行するURLリスト（元のURLと、自動補正した候補URL）
            var urlsToTry = [targetUrl];
            var fixedCandidate = generateFixedUrl(targetUrl);
            if (fixedCandidate !== targetUrl) {
                urlsToTry.push(fixedCandidate);
            }

            var fetchSuccess = false;
            var finalUsedUrl = targetUrl;

            // 各URL候補で順番にフェッチを試行
            for (var tIdx = 0; tIdx < urlsToTry.length; tIdx++) {
                var currentTryUrl = urlsToTry[tIdx];
                if (targetUrl === window.location.href) {
                    doc = document.cloneNode(true);
                    fetchSuccess = true;
                    break;
                } else {
                    try {
                        var res = await fetch(currentTryUrl);
                        if (res.ok) {
                            var textHtml = await res.text();
                            var parser = new DOMParser();
                            doc = parser.parseFromString(textHtml, "text/html");
                            fetchSuccess = true;
                            finalUsedUrl = currentTryUrl;
                            break;
                        }
                    } catch (fetchErr) {
                        // 失敗した場合は次の候補へ
                    }
                }
            }

            // どうしても取得できなかった場合（404等）の出力処理
            if (!fetchSuccess) {
                var failMsg = "[取得失敗: 404 Not Found / 予約投稿・スラッシュ崩れ]\n";
                failMsg += "■ 入力URL: " + decodedTargetUrl + "\n";
                failMsg += "■ 自動推測・修正候補URL: " + fixedCandidate + "\n";
                failMsg += "--------------------";
                resultsSummary.push(failMsg);
                continue;
            }

            // ==========================================
            // 4. ページ内のノイズ要素（ヘッダー・サイドバー等）の削除
            // ==========================================
            var noiseSelectors = [
                '#wpadminbar', '#adminmenu', '#adminmenuback', '.header-container', 'header',
                '#sidebar', '.sidebar', 'aside', '.widget', '#secondary',
                '.ranking-item', '.ranking-box', '.popular-posts', '.wpp-list', '.widget_related',
                '.related-posts', '.sns-share', '.author-box', 'footer', '.footer', '#footer'
            ];
            noiseSelectors.forEach(function(sel) {
                doc.querySelectorAll(sel).forEach(function(el) { el.remove(); });
            });

            // 本文エリアとタイトル・日時の抽出
            var mainContent = doc.querySelector('div.entry-content.cf[itemprop="mainEntityOfPage"], .entry-content.cf, .entry-content, .post-content, .article-body, .entry-body') || doc.body;
            var body = doc.body;
            txt = body ? body.innerText : "";
            html = body ? body.innerHTML : "";
            var titleEl = doc.querySelector('.entry-title, h1.post-title, h1');
            titleText = titleEl ? titleEl.innerText.trim() : "（タイトル取得できず）";

            // 公開日時・予約投稿日時のメタタグ＆タイムスタンプ抽出
            var metaPub = doc.querySelector('meta[property="article:published_time"], meta[property="og:article:published_time"], meta[name="pubdate"], meta[name="date"], meta[itemprop="datePublished"]');
            var timeEl = doc.querySelector('time.published, time.entry-date, time[datetime], .date, .post-date, .published');
            
            if (metaPub && metaPub.getAttribute('content')) {
                dateStr = metaPub.getAttribute('content').replace('T', ' ').substring(0, 19) + " （公開/メタ情報）";
            } else if (timeEl) {
                dateStr = (timeEl.getAttribute('datetime') || timeEl.innerText).trim().substring(0, 19) + " （タイムスタンプ検出）";
            } else {
                var dateMatch = txt.match(/\d{4}[\/\-年]\d{1,2}[\/\-月]\d{1,2}日?/);
                if (dateMatch) dateStr = dateMatch[0] + " （本文内テキスト）";
            }

            // ==========================================
            // 5. 各種条件・チェック項目の判定処理
            // ==========================================
            if (!titleEl) m.push("記事タイトル");
            if (!doc.querySelector('.post-thumbnail img, .eyecatch img, .wp-post-image, .attachment-post-thumbnail')) m.push("アイキャッチ画像");

            // タイトル先頭の都道府県チェック
            var hasPrefStart = false;
            for (var j = 0; j < prefs.length; j++) {
                if (titleText.indexOf(prefs[j]) === 0) {
                    hasPrefStart = true;
                    l.push("タイトル先頭地名(" + prefs[j] + ")");
                    break;
                }
            }

            // カテゴリの取得
            var catEls = doc.querySelectorAll('.cat-label, [class*="cat-label"], a[rel="category tag"], a[href*="/category/"]');
            var catNames = [];
            catEls.forEach(function(el) {
                var cName = el.innerText.trim();
                if (cName && catNames.indexOf(cName) === -1) catNames.push(cName);
            });
            var categoryStr = catNames.length > 0 ? catNames.join(", ") : "";
            if (categoryStr === "") m.push("カテゴリ未分類");
            
            // 必須キーワードの網羅チェック
            r.forEach(function(item) {
                if (item === "Googleマップ") {
                    if (txt.indexOf("Googleマップ") === -1 && !doc.querySelector('iframe[src*="google.com/maps"]')) m.push("Googleマップなし");
                } else {
                    if (txt.indexOf(item) === -1) m.push(item);
                }
            });

            var hasCaption = doc.querySelectorAll('figcaption, .wp-caption-text').length > 0;
            if (hasCaption) l.push("画像キャプション検出");
            
            // [拡張ポイント] AIコードや不自然な文言の検知ルール
            var hasAiCode = /cit_[a-zA-Z0-9_-]{5,}|data-cit|googleapis\.com\/v[0-9]|citation/.test(html);
            if (hasAiCode) l.push("AIコード混入");

            var hasAiText = txt.indexOf("入力されています") !== -1 || txt.indexOf("入力情報では") !== -1 || txt.indexOf("「-」と入力") !== -1;
            if (hasAiText) l.push("AI不自然文言");

            // 半角カタカナの混入チェック
            var halfWidthKatakanaPattern =
