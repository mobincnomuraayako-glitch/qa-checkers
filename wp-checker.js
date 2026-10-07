(async function(){
    try {
        // 1. 入力モーダルの生成（20件一括入力対応）
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
                header.innerText = "WordPress記事URL一括チェック（自動スラッグ補正強化版）";
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

        // 💡 修正：全角・半角パイプ、スペース等をハイフンに置換しつつ、日本語部分はURLエンコードを考慮する関数
        function generateFixedUrl(rawUrl) {
            try {
                var decoded = decodeURIComponent(rawUrl);
                var fixed = decoded.replace(/[｜|%7C\s ]+/g, '-');
                fixed = fixed.replace(/-+/g, '-');
                
                // URLオブジェクト化してパスを適切にエンコード
                try {
                    var urlObj = new URL(fixed);
                    var segments = urlObj.pathname.split('/').map(function(seg)
