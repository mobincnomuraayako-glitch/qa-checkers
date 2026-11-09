javascript:void((function(){
    var sel = window.getSelection();
    if (!sel.rangeCount) return;
    var container = document.createElement("div");
    for (var i = 0; i < sel.rangeCount; ++i) {
        container.appendChild(sel.getRangeAt(0).cloneContents());
    }
    
    // HTML内のリンクタグ(a要素)またはテキスト内のURLを置換
    var cleanUrl = function(urlStr) {
        try {
            var url = new URL(urlStr);
            // utm_で始まるパラメータを全削除
            var keys = [];
            url.searchParams.forEach(function(val, key){
                if(key.startsWith('utm_')) keys.push(key);
            });
            keys.forEach(function(k){ url.searchParams.delete(k); });
            
            // クエリが空になったら「?」ごと削除
            var finalStr = url.toString();
            if(url.search === '') finalStr = finalStr.replace(/\?$/, '');
            return finalStr;
        } catch(e) {
            return urlStr;
        }
    };

    // 選択範囲内の <a> タグの処理
    var links = container.getElementsByTagName('a');
    for (var j = 0; j < links.length; j++) {
        links[j].href = cleanUrl(links[j].href);
        links[j].setAttribute('target', '_blank');
        links[j].setAttribute('rel', 'noopener noreferrer');
    }

    // 選択範囲内のテキストノードに含まれるURL文字列の処理
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    var node;
    var urlRegex = /https?:\/\/[^\s<]+[^\s<.,;:?!'"\)\]}]/g;
    while(node = walker.nextNode()) {
        if(node.parentNode.tagName !== 'A') {
            var text = node.nodeValue;
            if(urlRegex.test(text)) {
                var newHtml = text.replace(urlRegex, function(match){
                    var cleaned = cleanUrl(match);
                    return '<a href="' + cleaned + '" target="_blank" rel="noopener noreferrer">' + cleaned + '</a>';
                });
                var span = document.createElement('span');
                span.innerHTML = newHtml;
                node.parentNode.replaceChild(span, node);
            }
        }
    }

    // 選択範囲を置き換え
    var range = sel.getRangeAt(0);
    range.deleteContents();
    var frag = range.createContextualFragment(container.innerHTML);
    range.insertNode(frag);
})());
