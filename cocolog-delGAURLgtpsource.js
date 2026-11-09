(function(){
    var s = window.getSelection();
    if (!s.rangeCount) return;
    var r = s.getRangeAt(0);
    var d = document.createElement('div');
    d.appendChild(r.cloneContents());
    
    var l = d.getElementsByTagName('a');
    for (var i = 0; i < l.length; i++) {
        try {
            var u = new URL(l[i].href), k = [];
            u.searchParams.forEach(function(v, p){ if(p.indexOf('utm_') === 0) k.push(p); });
            k.forEach(function(p){ u.searchParams.delete(p); });
            var c = u.toString();
            if (!u.search) c = c.replace(/\?$/, '');
            l[i].href = c;
            l[i].textContent = c;
        } catch(e) {}
    }
    
    r.deleteContents();
    r.insertNode(d.ownerDocument.createRange().createContextualFragment(d.innerHTML));
})();
