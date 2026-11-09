(function(){
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
        alert('置換したいテキストやURLを選択してください。');
        return;
    }

    var cleanUrl = function(urlStr) {
        try {
            var url = new URL(urlStr);
            var keys = [];
            url.searchParams.forEach(function(val, key){
                if(key.startsWith('utm_')) keys.push(key);
            });
            keys.forEach(function(k){ url.searchParams.delete(k); });
            var finalStr = url.toString();
            if(url.search === '') finalStr = finalStr.replace(/\?$/, '');
            return finalStr;
        } catch(e) {
            return urlStr;
        }
    };

    var range = sel.getRangeAt(0);
    var container = document.createElement("div");
    container.appendChild(range.cloneContents());

    // 1. 既存の<a>タグのパラメータ削除 ＆ 別窓設定
    var links = container.getElementsByTagName('a');
    for (var j = 0; j < links.length; j++) {
        links[j].href = cleanUrl(links[j].href);
        links[j].setAttribute('target', '_blank');
        links[j].setAttribute('rel', 'noopener noreferrer');
    }

    // 2. テキスト内のURL自動リンク化 ＆ パラメータ削除 ＆ 別窓設定
    var urlRegex = /https?:\/\/[^\s<]+[^\s<.,;:?!'"\)\]}]/g;
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    var node;
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

    // 選択範囲を安全に置き換え
    range.deleteContents();
    var frag = range.createContextualFragment(container.innerHTML);
    range.insertNode(frag);
})();
