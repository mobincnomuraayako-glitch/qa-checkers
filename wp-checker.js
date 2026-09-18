// ==========================================
// リンク抽出部分の堅牢化（店舗情報一覧 ＆ 編集部コメント）
// ==========================================
var shopInfoUrl = null;
var editorCommentUrl = null;

// 無効なURLを弾くフィルター
function isValidStoreUrl(h) {
    if(!h) return false;
    var trimmed = h.trim();
    if(trimmed.startsWith('#') || trimmed.includes('javascript:')) return false;
    if(trimmed.includes('google.com/maps') || trimmed.includes('ja.wordpress.org') || trimmed.includes('wordpress.com')) return false;
    if(trimmed.includes('/wp-admin/') || trimmed.includes('/wp-login.php') || trimmed.includes('about.php')) return false;
    if(trimmed.includes('btj-romance-lab.com') && (trimmed.includes('/wp-admin') || trimmed.includes('about.php') || trimmed.includes('/local-guide/'))) return false;
    return true;
}

// 1. 「店舗情報一覧」付近のリンクを探索
var allEls = Array.from(mainContent.querySelectorAll('*'));
var shopEl = allEls.find(function(el){ return el.children.length === 0 && el.innerText && el.innerText.trim().includes('店舗情報一覧'); });
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

// 2. 「編集部コメント」付近のリンク（ブログカードや通常のリンク）を探索
var editorEl = allEls.find(function(el){ return el.children.length === 0 && el.innerText && el.innerText.trim().includes('編集部コメント'); });
if(editorEl){
    // 編集部コメント以降にあるブログカードやアンカーを探す
    var blogcards = Array.from(mainContent.querySelectorAll('.blogcard, .external-blogcard, [class*="blogcard"], .wp-block-embed'));
    var targetCard = blogcards.find(function(card){ return editorEl.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING; });
    
    if(targetCard) {
        var aTag = targetCard.querySelector('a[href]');
        if(aTag && isValidStoreUrl(aTag.getAttribute('href'))){
            editorCommentUrl = aTag.getAttribute('href').trim();
        }
    }
    
    // ブログカードで見つからなければ、編集部コメント以降の通常のリンクを探す
    if(!editorCommentUrl) {
        var allAnchors = Array.from(mainContent.querySelectorAll('a[href]'));
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

// 万が一どちらかが見つからない場合のフォールバック（有効なURLを前から順番に割り当て）
if(!shopInfoUrl || !editorCommentUrl) {
    var fallbackAnchors = Array.from(mainContent.querySelectorAll('a[href]')).map(function(a){ return a.getAttribute('href'); }).filter(isValidStoreUrl);
    // 重複を排除
    fallbackAnchors = Array.from(new Set(fallbackAnchors));
    
    if(!shopInfoUrl && fallbackAnchors.length > 0) {
        shopInfoUrl = fallbackAnchors[0];
    }
    if(!editorCommentUrl && fallbackAnchors.length > 1) {
        // 店舗情報とは違うURLを編集部コメントに割り当てる
        editorCommentUrl = fallbackAnchors.find(function(u){ return u !== shopInfoUrl; }) || fallbackAnchors[fallbackAnchors.length - 1];
    } else if(!editorCommentUrl && fallbackAnchors.length === 1) {
        editorCommentUrl = fallbackAnchors[0];
    }
}

if(shopInfoUrl) targetUrls.push({name:"店舗情報一覧",url:shopInfoUrl});
if(editorCommentUrl) targetUrls.push({name:"編集部コメント",url:editorCommentUrl});
if(mapUrl) targetUrls.push({name:"Googleマップ",url:mapUrl});
