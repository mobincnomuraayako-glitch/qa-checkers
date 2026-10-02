(function(){try{
    // 1. 必須見出し（構成項目）の定義
    var r=["基本情報","店舗概要","所在地・アクセス","営業時間・定休日","サービス","設備","店舗情報一覧","まとめ","FAQ","編集部コメント","Googleマップ"];
    var m=[],l=[];
    
    // 2. メインコンテンツ領域の特定（記事本文の抽出）
    var mainContent=document.querySelector('div.entry-content.cf[itemprop="mainEntityOfPage"], .entry-content.cf, .entry-content, .post-content, .article-body, .entry-body')||document.body;
    
    var body=document.body;
    var txt=body?body.innerText:"";
    var html=body?body.innerHTML:"";
    var titleEl=document.querySelector('.entry-title, h1.post-title, h1');
    var titleText=titleEl?titleEl.innerText.trim():"";
    
    // 3. タイトルやアイキャッチ画像の存在チェック
    if(!titleText)m.push("記事タイトル");
    if(!document.querySelector('.post-thumbnail img, .eyecatch img, header img, .wp-post-image, .attachment-post-thumbnail'))m.push("アイキャッチ画像");
    
    // 4. タイトルの先頭地名チェック（都道府県名で始まっていないか）
    var prefs=["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"];
    for(var i=0;i<prefs.length;i++){
        if(titleText.indexOf(prefs[i])===0){
            l.push("タイトル異常: 先頭が地名("+prefs[i]+")");
            break;
        }
    }
    
    // 5. カテゴリおよび必須見出しの存在チェック
    if(!txt.includes("カテゴリ")&&!document.querySelector('.entry-categories, .cat-links, [class*="category"]'))m.push("カテゴリ未分類");
    
    r.forEach(function(item){
        if(item==="Googleマップ"){
            if(!txt.includes("Googleマップ")&&!document.querySelector('iframe[src*="google.com/maps"]'))m.push("Googleマップなし");
        }else{
            if(!txt.includes(item))m.push(item);
        }
    });
    
    // 6. 画像キャプション、AI特有のコード・不自然な文言の混入チェック
    if(document.querySelectorAll('figcaption, .wp-caption-text').length>0)l.push("画像キャプション検出");
    if(/cit_[a-zA-Z0-9_-]{5,}|data-cit|googleapis\.com\/v[0-9]|citation/.test(html))l.push("AIコンテキストコード混入");
    if(txt.includes("入力されています")||txt.includes("入力情報では")||txt.includes("「-」と入力"))l.push("AI特有の不自然な文言");

    // 7. 【追加】半角カタカナの混入判定（文字消失リスク対策）
    var halfWidthKatakanaPattern = /[\uFF61-\uFF9F]/;
    if (halfWidthKatakanaPattern.test(titleText) || halfWidthKatakanaPattern.test(mainContent.innerText)) {
        l.push("半角カタカナの混入検知 (文字消失リスクあり)");
    }

    // 8. 対応エリアと店舗の番地記載の整合性チェック
    var areaKeywords=["対応エリア","出張可能エリア","出張エリア","対象エリア"];
    var hasAreaMention=areaKeywords.some(function(kw){return txt.includes(kw);});
    if(hasAreaMention){
        var banchiPattern=/\d+[\-−ー\d]+|\d+丁目|\d+番地?|\d+号/;
        if(banchiPattern.test(txt)){
            l.push("店舗あり(番地記載あり)のため対応エリア等の記載不可");
        }
    }

    // 9. 見出しおよび本文の連続重複ワード（文字の繰り返し）のチェック
    var headings = mainContent.querySelectorAll('h1, h2, h3');
    headings.forEach(function(h){
        var t = h.innerText.trim();
        if(/([一-龥]{2,})\1/.test(t) || /([\u3040-\u309F]{2,})\1/.test(t)) {
            l.push("見出しの重複異常(連続ワード): " + t);
        }
    });

    var paragraphs = mainContent.querySelectorAll('p, li');
    paragraphs.forEach(function(p){
        var pt = p.innerText.trim();
        var matchKanji = pt.match(/([一-龥]{2,})\1/);
        var matchHira = pt.match(/([\u3040-\u309F]{2,})\1/);
        if(matchKanji || matchHira) {
            var dupWord = matchKanji ? matchKanji[1] : matchHira[1];
            if(!l.some(function(msg){ return msg.includes("本文中の重複異常"); })) {
                l.push("本文中の重複異常(連続ワード検知): " + dupWord);
            }
        }
    });

    // 10. 公開日時の取得
    var meta=document.querySelector('meta[property="article:published_time"], meta[property="og:article:published_time"]');
    var dateStr=meta?meta.getAttribute('content'):"取得できず";

    // 11. 確認対象URL（Googleマップ・店舗情報・編集部コメント）の抽出ロジック
    var targetUrls=[];
    var gmap=document.querySelector('iframe[src*="google.com/maps"], iframe[src*="maps.google"]');
    var mapUrl=gmap?(gmap.getAttribute('src')||""):"";
    if(mapUrl)targetUrls.push({name:"Googleマップ",url:mapUrl});

    var shopInfoUrl=null;
    var editorCommentUrl=null;

    function isValidStoreUrl(h) {
        if(!h) return false;
        var trimmed = h.trim();
        if(trimmed.startsWith('#') || trimmed.includes('javascript:')) return false;
        if(trimmed.includes('google.com/maps') || trimmed.includes('ja.wordpress.org') || trimmed.includes('wordpress.com')) return false;
        if(trimmed.includes('/wp-admin/') || trimmed.includes('/wp-login.php') || trimmed.includes('about.php')) return false;
        if(trimmed.includes('btj-romance-lab.com') && (trimmed.includes('/wp-admin') || trimmed.includes('about.php') || trimmed.includes('/local-guide/'))) return false;
        return true;
    }

    var allEls=Array.from(mainContent.querySelectorAll('*'));
    var shopEl=allEls.find(function(el){ return el.children.length === 0 && el.innerText && el.innerText.trim().includes('店舗情報一覧'); });
    if(shopEl){
        var cur = shopEl.closest('h1,h2,h3,h4,div,section,table,tr,p') || shopEl;
        for(let step = 0; step < 5; step++) {
            if(!cur) break;
            var aList = Array.from(cur.querySelectorAll('a[href]'));
            if(cur.tagName === 'A') aList.unshift(cur);
            for(var a of aList){
                var h = a.getAttribute('href');
                if(isValidStoreUrl(h)){
                    shopInfoUrl = h.trim();
                    break;
                }
            }
            if(shopInfoUrl) break;
            cur = cur.nextElementSibling || cur.parentElement;
        }
    }

    var editorEl=allEls.find(function(el){ return el.children.length === 0 && el.innerText && el.innerText.trim().includes('編集部コメント'); });
    if(editorEl){
        var blogcards=Array.from(mainContent.querySelectorAll('.blogcard, .external-blogcard, [class*="blogcard'], .wp-block-embed'));
        var targetCard=blogcards.find(function(card){ return editorEl.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING; });
        if(targetCard) {
            var aTag = targetCard.querySelector('a[href]');
            if(aTag && isValidStoreUrl(aTag.getAttribute('href'))){
                editorCommentUrl = aTag.getAttribute('href').trim();
            }
        }
        if(!editorCommentUrl) {
            var allAnchors=Array.from(mainContent.querySelectorAll('a[href]'));
            for(var a of allAnchors){
                if(editorEl.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING){
                    var h2 = a.getAttribute('href');
                    if(isValidStoreUrl(h2)){
                        editorCommentUrl = h2.trim();
                        break;
                    }
                }
            }
        }
    }

    if(!shopInfoUrl || !editorCommentUrl) {
        var fallbackAnchors = Array.from(mainContent.querySelectorAll('a[href]')).map(function(a){ return a.getAttribute('href'); }).filter(isValidStoreUrl);
        fallbackAnchors = Array.from(new Set(fallbackAnchors));
        if(!shopInfoUrl && fallbackAnchors.length > 0) {
            shopInfoUrl = fallbackAnchors[0];
        }
        if(!editorCommentUrl && fallbackAnchors.length > 1) {
            editorCommentUrl = fallbackAnchors.find(function(u){ return u !== shopInfoUrl; }) || fallbackAnchors[fallbackAnchors.length - 1];
        } else if(!editorCommentUrl && fallbackAnchors.length === 1) {
            editorCommentUrl = fallbackAnchors[0];
        }
    }

    if(shopInfoUrl) targetUrls.push({name:"店舗情報一覧",url:shopInfoUrl});
    if(editorCommentUrl) targetUrls.push({name:"編集部コメント",url:editorCommentUrl});

    // 12. チェック結果の集計とアラート表示・別タブオープン処理
    var res="【WPチェック結果】\n\n📅 日時: "+dateStr+"\n\n";
    if(m.length===0&&l.length===0){
        res+="✅ チェックOK！\n";
    }else{
        if(m.length>0)res+="❌ 不足:\n・"+m.join("\n・")+"\n\n";
        if(l.length>0)res+="⚠️ 異常:\n・"+l.join("\n・")+"\n";
    }
    res+="\n--------------------\n確認対象URL: "+targetUrls.length+"件\n";
    targetUrls.forEach(function(u){
        res+="・["+u.name+"] "+u.url+"\n";
    });
    alert(res);
    if(targetUrls.length>0&&confirm("確認対象のURL("+targetUrls.length+"件)を別タブで開きますか？")){
        targetUrls.forEach(function(u){window.open(u.url,'_blank');});
    }
}catch(e){alert("エラー: "+e.message);}})();
