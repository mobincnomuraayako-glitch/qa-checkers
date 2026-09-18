var shopInfoUrl = null;
var editorCommentUrl = null;
var allEls = Array.from(mainContent.querySelectorAll('*'));

// 無効なURL（管理画面、自サイトの内部リンク、アンカー、マップなど）を徹底的に弾く関数
function isValidStoreUrl(u) {
    if(!u) return false;
    var trimmed = u.trim();
    if(trimmed === '#' || trimmed.startsWith('#')) return false;
    if(trimmed.includes('/wp-admin/') || trimmed.includes('/wp-login.php')) return false;
    if(trimmed.includes('s.wordpress.com') || trimmed.includes('google.com/maps')) return false;
    
    // 自サイトのURL（btj-romance-lab.com）内の管理ページや内部階層っぽかったら除外する
    if(trimmed.includes('btj-romance-lab.com')) {
        // 例: local-guide/wp-admin や about.php などを弾く
        if(trimmed.includes('/wp-admin') || trimmed.includes('about.php') || trimmed.includes('/local-guide/')) {
            return false;
        }
    }
    return true;
}

// 1. 店舗情報一覧のURL抽出
var shopEl = allEls.find(function(el){ return el.children.length === 0 && el.innerText && el.innerText.trim().includes('店舗情報一覧'); });
if(shopEl){
    var cur = shopEl.closest('h1,h2,h3,h4,div,section,p') || shopEl;
    // 見出しの周辺や次の要素から、有効な外部URLを本気で探す
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
