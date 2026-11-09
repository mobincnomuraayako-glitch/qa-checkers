(function(){
    // 1. エディタ内か通常ページかに関わらず、現在の選択範囲を取得する汎用処理
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
        alert('パラメータを削除したいテキストやURLを選択してください。');
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
    var container = document.createElement('div');
    container.appendChild(range.cloneContents());

    // HTMLが含まれていない（ただのテキスト選択の）場合の保険
    if (container.innerHTML.trim() === '') {
        container.textContent = range.toString();
    }

    // 2. <a>タグのリンク処理
    var links = container.getElementsByTagName('a');
    for (var i = 0; i < links.length; i++) {
        links[i].href = cleanUrl(links[i].href);
        links[i].target = '_blank';
        links[i].rel = 'noopener noreferrer';
    }

    // 3. プレーンテキスト中のURL処理
    var html = container.innerHTML;
    var urlRegex = /https?:\/\/[^\s<"']+/g;
    
    // すでに<a>タグになっているものは置換除外して、テキスト内のURLだけを綺麗にする
    html = html.replace(urlRegex, function(match){
        if (match.indexOf('href=') !== -1 || match.indexOf('</a') !== -1) {
            return match;
        }
        var cleaned = cleanUrl(match);
        return '<a href="' + cleaned + '" target="_blank" rel="noopener noreferrer">' + cleaned + '</a>';
    });

    // 4. 選択範囲を置き換え
    range.deleteContents();
    var frag = range.createContextualFragment(html);
    range.insertNode(frag);
    
    console.log('UTMパラメータ削除 ＆ 別窓設定が完了しました。');
})();
