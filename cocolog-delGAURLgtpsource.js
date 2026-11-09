javascript:(function(){
  try {
    var count = 0;
    var cleanUrl = function(urlStr) {
      try {
        var url = new URL(urlStr);
        var keys = [];
        url.searchParams.forEach(function(val, key){
          if(key.indexOf('utm_') === 0) keys.push(key);
        });
        keys.forEach(function(k){ url.searchParams.delete(k); });
        var finalStr = url.toString();
        if(url.search === '') finalStr = finalStr.replace(/\?$/, '');
        return finalStr;
      } catch(e) {
        return urlStr;
      }
    };

    var urlRegex = /(https?:\/\/[^\s<>\u3000-\u303F\u3040-\u309F\u30A0-\u30FF]+)/gi;

    /* 1. リッチテキストエディタ（TinyMCE）が開いている場合 */
    if (typeof tinyMCE !== 'undefined' && tinyMCE.activeEditor && !tinyMCE.activeEditor.isHidden()) {
      var editor = tinyMCE.activeEditor;
      var doc = editor.getDoc();
      if (!doc) { alert('エディタの読み込みに失敗しました'); return; }

      // 既存の<a>タグのパラメータを掃除する処理
      var links = doc.getElementsByTagName('a');
      for (var i = 0; i < links.length; i++) {
        var oldHref = links[i].href;
        var newHref = cleanUrl(oldHref);
        if (oldHref !== newHref) {
          links[i].href = newHref;
          links[i].textContent = newHref;
          count++;
        }
      }

      function processNode(node) {
        if (node.nodeType === 3) {
          var parent = node.parentNode;
          if (parent && parent.nodeName.toLowerCase() !== 'a' && parent.nodeName.toLowerCase() !== 'script' && parent.nodeName.toLowerCase() !== 'style') {
            var text = node.nodeValue;
            if (urlRegex.test(text)) {
              var fragment = doc.createDocumentFragment();
              var lastIndex = 0;
              text.replace(urlRegex, function(match, url, offset) {
                fragment.appendChild(doc.createTextNode(text.substring(lastIndex, offset)));
                var clean = cleanUrl(url.replace(/\\/g, ''));
                var a = doc.createElement('a');
                a.href = clean;
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = clean;
                fragment.appendChild(a);
                lastIndex = offset + match.length;
                count++;
              });
              fragment.appendChild(doc.createTextNode(text.substring(lastIndex)));
              parent.replaceChild(fragment, node);
            }
          }
        } else if (node.nodeType === 1) {
          var children = Array.from(node.childNodes);
          for (var j = 0; j < children.length; j++) {
            processNode(children[j]);
          }
        }
      }
      processNode(doc.body);
      editor.save();
      editor.isNotDirty = false;

    /* 2. 通常エディタ（テキストエリア）が開いている場合 */
    } else {
      var textarea = document.querySelector('textarea[name="text"]') || document.querySelector('textarea');
      if (!textarea) {
        alert('入力エリアが見つかりませんでした。');
        return;
      }
      var text = textarea.value;
      
      // テキストエリア内のURLをクリーンアップ
      var newText = text.replace(urlRegex, function(match, url) {
        var clean = cleanUrl(url.replace(/\\/g, ''));
        count++;
        return clean;
      });

      textarea.value = newText;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (count > 0) {
      alert(count + ' 件のURLからutmパラメータ等のゴミを削除しました！');
    } else {
      alert('対象となるURLやパラメータは見つかりませんでした。');
    }
  } catch(e) {
    alert('実行エラー: ' + e.message);
  }
})();
