javascript:(() => {
    if (window.__headlineModal) {
        window.__headlineModal.remove();
        delete window.__headlineModal;
        return;
    }

    const host = document.createElement('div');
    host.id = '__headlineModal';
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        :host { all: initial }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; }
        #overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 2147483647; display: flex; align-items: center; justify-content: center; }
        #headline-modal { width: min(720px, 92vw); max-height: 82vh; background: #fff; color: #111; border-radius: 14px; box-shadow: rgba(68, 68, 68, 0.12) 5px 5px 5px 0px; display: flex; flex-direction: column; overflow: hidden; font-size: 14px; }
        #headline-modal header { display: flex; flex-direction: column; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #eee; gap: 10px; }
        #headline-modal header h1 { font-weight: 600; font-size: 20px; }
        #headline-modal .input-container, #headline-modal .button-container { width: 100%; display: flex; gap: 6px; }
        #headline-modal .rel { position: relative; }
        #headline-modal input, #headline-modal select { height: 30px; }
        #headline-modal input:focus, #headline-modal select:focus { outline: none; }
        #textFilter, #classFilter, #levelSelect { border: 1px solid #ddd; border-radius: 8px; padding: 6px 10px; background: #fff; }
        #textFilter, #classFilter { max-width: 200px; }
        #levelSelect { apearance: none; -webkit-appearance: none; -moz-appearance: none; background-color: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 6px 26px 6px 10px; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M5 7l5 6 5-6" stroke="%23888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'); background-repeat: no-repeat; background-position: right 8px center; background-size: 14px 14px; background-clip: padding-box; }
        #headline-modal button { border: 1px solid #ddd; background: #fafafa; border-radius: 8px; padding: 6px 10px; cursor: pointer; }
        #headline-modal button:hover { background: #f0f0f0; }
        #list { padding: 10px; overflow: auto; }
        #headline-modal ol { margin: 0; padding-left: 0; counter-reset: li; }
        #headline-modal li { list-style: none; padding: 6px; cursor: pointer; border-radius: 6px; display: flex; gap: 10px; align-items: flex-start; }
        #headline-modal li::before { counter-increment: li; content: counter(li) "."; flex: 0 0 auto; min-width: 3ch; text-align: left; color: #888; font-variant-numeric: tabular-nums; }
        #headline-modal li:hover { background: #f7f7f7; }
        #headline-modal footer { padding: 10px 12px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
        #empty { padding: 18px; text-align: center; color: #666; }
        .hl { outline: 3px solid rgba(14,165,233,.5); transition: outline-color .6s ease; }

        #classSuggest { position: absolute; top: calc(100% + 4px); left: 0; right: 0; max-height: 200px; overflow: auto; background: #fff; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 6px 18px rgba(0,0,0,.12); z-index: 1; display: none }
        #classSuggest button { width: 100%; text-align: left; background: #fff; border: 0; border-bottom: 1px solid #f2f2f2; padding: 8px 10px; font-size: 11px; cursor: pointer }
        #classSuggest button:last-child { border-bottom: 0 }
        #classSuggest button:hover { background: #f7f7f7 }
    `;

    const wrap = document.createElement('div');
    wrap.id = 'overlay';
    wrap.innerHTML = `
        <div id="headline-modal">
        <header>
            <h1>Headline Filter</h1>
            <div class="input-container">
            <select id="levelSelect" title="Heading level">
                <option value="h1">H1</option>
                <option value="h2" selected>H2</option>
                <option value="h3">H3</option>
                <option value="h4">H4</option>
                <option value="h5">H5</option>
                <option value="h6">H6</option>
            </select>
            <div class="rel">
                <input id="classFilter" type="text" value="typography-headline" placeholder="Filter by class">
                <div id="classSuggest"></div>
            </div>
            <input id="textFilter" type="search" placeholder="Filter by text"/>
            </div>
            <div class="button-container">
            <button id="copy">Copy text</button>
            <button id="close">Close</button>
            </div>
        </header>
        <div id="list"></div>
        <footer>Click a title to scroll.</footer>
        </div>
    `;
    root.append(style, wrap);

    const $ = (sel, parent = root) => parent.querySelector(sel);
    const list = $('#list');

    function uniqClassesFrom(tag) {
        const s = new Set();
        document.querySelectorAll(tag).forEach(el => el.classList.forEach(c => c && s.add(c)));
        return [...s].sort((a,b)=>a.localeCompare(b));
    }

    function getHeadings(tag, cls) {
        const sel = cls && cls.trim().length
        ? tag + '.' + cls.trim().split(/\s+/).join('.')
        : tag;
        return [...document.querySelectorAll(sel)]
        .map((el, i) => ({ el, text: (el.textContent || '').trim().replace(/\s+/g, ' '), i }))
        .filter(h => h.text.length);
    }

    let headings = [];
    let currentTag = 'h2';
    let classListCache = uniqClassesFrom(currentTag);

    function render(filter = '') {
        list.innerHTML = '';
        const items = headings.filter(h => h.text.toLowerCase().includes(filter.toLowerCase()));
        if (!items.length) {
            const d = document.createElement('div');
            d.id = 'empty';
            d.textContent = 'No ' + currentTag.toUpperCase() + ' found.';
            list.appendChild(d);
            return;
        }
        const ol = document.createElement('ol');
        items.forEach(h => {
            const li = document.createElement('li');
            li.textContent = h.text;
            li.title = 'Scroll to: ' + h.text;
            li.addEventListener('click', () => {
                host.remove();
                delete window.__headlineModal;
                h.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                h.el.classList.add('hl');
                setTimeout(() => h.el.classList.remove('hl'), 1200);
            });
            ol.appendChild(li);
        });
        list.appendChild(ol);
    }

    function copy(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(fallback);
        } else fallback();
        function fallback() {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy') } catch {}
            ta.remove();
        }
    }

    function refresh() {
        const cls = $('#classFilter').value;
        headings = getHeadings(currentTag, cls);
        render($('#textFilter').value || '');
    }

    function showClassSuggest() {
        const box = $('#classSuggest');
        const needle = ($('#classFilter').value || '').toLowerCase();
        const items = classListCache.filter(c => c.toLowerCase().includes(needle)).slice(0, 200);
        box.innerHTML = '';
        if (!items.length) { box.style.display = 'none'; return; }
        items.forEach(c => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = c;
            b.addEventListener('click', () => {
                $('#classFilter').value = c;
                box.style.display = 'none';
                refresh();
            });
            box.appendChild(b);
        });
        box.style.display = 'block';
    }

    function hideClassSuggestSoon() {
        const box = $('#classSuggest');
        setTimeout(() => { box.style.display = 'none'; }, 150);
    }

    $('#levelSelect').addEventListener('change', e => {
        currentTag = e.target.value || 'h2';
        classListCache = uniqClassesFrom(currentTag);
        refresh();
    });

    $('#copy').addEventListener('click', () => copy(headings.map(h => h.text).join('\n')));
    $('#close').addEventListener('click', () => { host.remove(); delete window.__headlineModal; });
    $('#textFilter').addEventListener('input', e => render(e.target.value || ''));
    $('#classFilter').addEventListener('input', () => { showClassSuggest(); refresh(); });
    $('#classFilter').addEventListener('focus', showClassSuggest);
    $('#classFilter').addEventListener('blur', hideClassSuggestSoon);
    $('#classFilter').addEventListener('keydown', e => { if (e.key === 'Enter') { refresh(); $('#classSuggest').style.display = 'none'; } });

    wrap.addEventListener('click', e => {
        if (e.target.id === 'overlay') {
            host.remove();
            delete window.__headlineModal;
        }
    });

    document.addEventListener('keydown', window.__h2Esc = e => {
        if (e.key === 'Escape') {
            host.remove();
            delete window.__headlineModal;
            document.removeEventListener('keydown', window.__h2Esc);
        }
    });

    $('#levelSelect').value = 'h2';
    $('#classFilter').value = 'typography-headline';
    refresh();
    window.__headlineModal = host;
})();
