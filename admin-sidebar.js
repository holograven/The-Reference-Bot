/**
 * admin-sidebar.js — Right-side slide panel for image uploads.
 * Shared by index.html and project_detail.html.
 */
(function() {
    if (document.getElementById('admin-sidebar-loaded')) return;
    var marker = document.createElement('meta');
    marker.id = 'admin-sidebar-loaded';
    document.head.appendChild(marker);

    var REPO_OWNER = 'holograven';
    var REPO_NAME = 'The-Reference-Bot';
    var API_BASE = 'https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME;
    var AUTH_API = '/api/auth';

    var selectedFiles = [];
    var githubToken = localStorage.getItem('admin_github_token') || '';
    var authToken = localStorage.getItem('admin_auth_token') || '';

    // ---- DOM refs ----
    var sidebar = document.getElementById('admin-sidebar');
    var overlay = document.getElementById('admin-overlay');
    var toggle = document.getElementById('admin-toggle');

    function $(id) { return document.getElementById(id); }

    // Only init if sidebar exists on this page
    if (!sidebar || !overlay || !toggle) return;

    // ---- Sidebar toggle ----
    function isMobile() {
        return window.innerWidth <= 768;
    }

    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        initAdminState();
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    toggle.addEventListener('click', function(e) {
        e.preventDefault();
        if (isMobile()) {
            window.location.href = 'admin.html';
        } else {
            sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
        }
    });

    overlay.addEventListener('click', closeSidebar);
    $('admin-sidebar-close').addEventListener('click', closeSidebar);

    // ESC to close
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
    });

    // ---- Admin state machine ----
    function initAdminState() {
        if (authToken && githubToken) {
            showUploadScreen();
        } else if (authToken) {
            showTokenScreen();
        } else {
            showLoginScreen();
        }
    }

    function showScreen(id) {
        ['as-login','as-token','as-upload'].forEach(function(s) {
            $(s).classList.remove('active');
        });
        $(id).classList.add('active');
    }

    function showLoginScreen() {
        showScreen('as-login');
        $('as-password').value = '';
        clearMsg('as-login-msg');
    }

    function showTokenScreen() {
        showScreen('as-token');
        $('as-token-input').value = githubToken || '';
        clearMsg('as-token-msg');
    }

    function showUploadScreen() {
        showScreen('as-upload');
        populateFilms();
        onFilmChange();
        updateUploadBtn();
    }

    // ---- Auth ----
    $('as-login-btn').addEventListener('click', doLogin);
    $('as-password').addEventListener('keydown', function(e) { if (e.key==='Enter') doLogin(); });

    function doLogin() {
        var pw = $('as-password').value.trim();
        if (!pw) return showMsg('as-login-msg', 'Enter password', 'error');

        $('as-login-btn').disabled = true;
        fetch(AUTH_API, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ password: pw })
        }).then(function(r) { return r.json(); })
          .then(function(d) {
            if (d.success) {
                authToken = d.token;
                localStorage.setItem('admin_auth_token', authToken);
                githubToken ? showUploadScreen() : showTokenScreen();
            } else {
                showMsg('as-login-msg', d.error || 'Invalid password', 'error');
            }
        }).catch(function(e) {
            showMsg('as-login-msg', 'Network error', 'error');
        }).finally(function() {
            $('as-login-btn').disabled = false;
        });
    }

    // ---- Token ----
    $('as-token-save').addEventListener('click', saveToken);
    $('as-token-input').addEventListener('keydown', function(e) { if (e.key==='Enter') saveToken(); });

    function saveToken() {
        var t = $('as-token-input').value.trim();
        if (!t) return showMsg('as-token-msg', 'Enter token', 'error');
        githubToken = t;
        localStorage.setItem('admin_github_token', githubToken);
        showUploadScreen();
    }

    // ---- Logout ----
    $('as-logout-btn').addEventListener('click', function() {
        localStorage.removeItem('admin_auth_token');
        localStorage.removeItem('admin_github_token');
        authToken = '';
        githubToken = '';
        showLoginScreen();
    });

    // ---- Film selector ----
    function populateFilms() {
        var sel = $('as-film-select');
        sel.innerHTML = '<option value="__new__">+ New Film...</option>';
        var m = window.__MANIFEST__;
        if (m && m.projects) {
            Object.keys(m.projects).sort().forEach(function(name) {
                var opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                sel.appendChild(opt);
            });
        }
    }

    $('as-film-select').addEventListener('change', onFilmChange);

    function onFilmChange() {
        var val = $('as-film-select').value;
        var nameInput = $('as-new-film-name');
        var pickBtn = $('as-pick-btn');
        if (val === '__new__') {
            nameInput.style.display = 'block';
            nameInput.focus();
            pickBtn.style.display = 'none';
        } else {
            nameInput.style.display = 'none';
            pickBtn.style.display = 'block';
        }
        updateUploadBtn();
    }

    $('as-new-film-name').addEventListener('input', function() {
        updateUploadBtn();
        var has = this.value.trim().length > 0;
        $('as-pick-btn').style.display = has ? 'block' : 'none';
    });

    function getTargetFilm() {
        var val = $('as-film-select').value;
        return val === '__new__' ? $('as-new-film-name').value.trim() : val;
    }

    // ---- Image picker ----
    $('as-pick-btn').addEventListener('click', function() { $('as-image-input').click(); });
    $('as-image-input').addEventListener('change', function() {
        selectedFiles = Array.from(this.files || []);
        renderPreview();
        updateUploadBtn();
    });

    function renderPreview() {
        var grid = $('as-preview');
        grid.innerHTML = '';
        selectedFiles.forEach(function(file, i) {
            var item = document.createElement('div');
            item.className = 'preview-item';
            var img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            var rm = document.createElement('button');
            rm.className = 'remove-btn';
            rm.textContent = '\u00d7';
            rm.onclick = function(e) { e.stopPropagation(); removeImage(i); };
            item.appendChild(img);
            item.appendChild(rm);
            grid.appendChild(item);
        });
    }

    function removeImage(i) {
        selectedFiles.splice(i, 1);
        renderPreview();
        updateUploadBtn();
        $('as-image-input').value = '';
    }

    function clearPreview() {
        selectedFiles = [];
        $('as-preview').innerHTML = '';
        $('as-image-input').value = '';
    }

    function updateUploadBtn() {
        var film = getTargetFilm();
        $('as-upload-btn').disabled = !film || selectedFiles.length === 0;
    }

    // ---- Upload ----
    $('as-upload-btn').addEventListener('click', doUpload);

    function doUpload() {
        if (!githubToken) {
            showMsg('as-main-msg', 'GitHub token not set.', 'error');
            return;
        }
        var film = getTargetFilm();
        if (!film || selectedFiles.length === 0) return;

        $('as-upload-btn').disabled = true;
        var pw = $('as-progress-wrap');
        var pf = $('as-progress-fill');
        var pt = $('as-progress-text');
        var log = $('as-upload-log');
        clearMsg('as-main-msg');

        pw.style.display = 'block';
        pf.style.width = '0%';
        log.innerHTML = '';
        var total = selectedFiles.length;
        var success = 0, failed = 0;
        var isNew = ($('as-film-select').value === '__new__');
        var sorted = [].concat(selectedFiles).sort(function(a,b) {
            return a.name.localeCompare(b.name, undefined, {numeric:true});
        });

        function runUpload(i) {
            if (i >= sorted.length) {
                // Done with images
                pf.style.width = '100%';
                pt.textContent = 'Done: ' + success + ' uploaded, ' + failed + ' failed';
                if (isNew && success > 0) {
                    pt.textContent = 'Updating manifest...';
                    appendLog(log, 'Updating manifest.js...', '');
                    addFilmToManifest(film, sorted.map(function(f) { return f.name; }))
                        .then(function(r) {
                            appendLog(log, r.ok ? '\u2713 manifest.js updated' : '\u2717 manifest: ' + r.error, r.ok ? 'ok' : 'err');
                            finalize();
                        });
                } else {
                    finalize();
                }
                return;
            }

            var file = sorted[i];
            pf.style.width = Math.round(i/total*100) + '%';
            pt.textContent = 'Uploading ' + (i+1) + '/' + total + ': ' + file.name;

            uploadImage(film, file).then(function(r) {
                if (r.ok) { success++; appendLog(log, '\u2713 ' + file.name, 'ok'); }
                else { failed++; appendLog(log, '\u2717 ' + file.name + ': ' + r.error, 'err'); }
                runUpload(i + 1);
            }).catch(function(e) {
                failed++; appendLog(log, '\u2717 ' + file.name + ': ' + e.message, 'err');
                runUpload(i + 1);
            });
        }

        runUpload(0);

        function finalize() {
            $('as-upload-btn').disabled = false;
            if (success > 0) {
                showMsg('as-main-msg', '\u2713 ' + success + ' image(s) uploaded. Deploying...', 'success');
                clearPreview();
                setTimeout(function() { location.reload(); }, 3000);
            }
            updateUploadBtn();
        }
    }

    function uploadImage(film, file) {
        var path = 'reference/film/' + encodeURIComponent(film) + '/' + encodeURIComponent(file.name);
        return fileToBase64(file).then(function(b64) {
            var content = b64.replace(/^data:[^;]+;base64,/, '');
            var body = {
                message: '\uD83D\uDCF1 admin: upload ' + file.name + ' to ' + film,
                content: content,
                branch: 'main'
            };
            // Check for existing file SHA
            return ghFetch('GET /contents/' + path + '?ref=main').then(function(r) {
                if (r.ok) return r.json().then(function(d) { body.sha = d.sha; });
            }).catch(function() {}).then(function() {
                return ghFetch('PUT /contents/' + path, {
                    method: 'PUT', body: JSON.stringify(body)
                });
            });
        }).then(function(r) {
            if (r.ok) return { ok: true };
            return r.json().catch(function() { return {}; }).then(function(d) {
                return { ok: false, error: d.message || r.statusText };
            });
        });
    }

    function addFilmToManifest(film, imageNames) {
        return ghFetch('GET /contents/manifest.js?ref=main').then(function(r) {
            if (!r.ok) return r.json().then(function(d) { throw new Error(d.message); });
            return r.json();
        }).then(function(data) {
            var sha = data.sha;
            var bytes = Uint8Array.from(atob(data.content), function(c) { return c.charCodeAt(0); });
            var raw = new TextDecoder('utf-8').decode(bytes);
            var m = raw.match(/window\.__MANIFEST__\s*=\s*({[\s\S]*?});/);
            if (!m) throw new Error('Cannot parse manifest');
            var manifest = JSON.parse(m[1]);
            if (!manifest.projects) manifest.projects = {};
            var today = new Date().toISOString().slice(0,10).replace(/-/g,'/');
            manifest.projects[film] = {
                images: imageNames,
                hasDescription: false,
                lastEdit: today
            };
            var newContent = '// ============================================================\n' +
                '//  MANIFEST — Single source of truth for all film projects\n' +
                '//  Add new movies here. Each key = folder name under reference/film/\n' +
                '//  Both index.html and project_detail.html read from this file.\n' +
                '//  lastEdit:  manual date string, update when you add/change images\n' +
                '// ============================================================\n' +
                'window.__MANIFEST__ = ' + JSON.stringify(manifest, null, 2) + ';\n';
            return ghFetch('PUT /contents/manifest.js', {
                method: 'PUT',
                body: JSON.stringify({
                    message: '\uD83D\uDCF1 admin: add film "' + film + '"',
                    content: btoa(unescape(encodeURIComponent(newContent))),
                    sha: sha, branch: 'main'
                })
            });
        }).then(function(r) {
            if (r.ok) return { ok: true };
            return r.json().catch(function() { return {}; }).then(function(d) {
                return { ok: false, error: d.message };
            });
        });
    }

    // ---- GitHub API ----
    function ghFetch(endpoint, opts) {
        var parts = endpoint.split(' ', 2);
        var url = API_BASE + parts[1];
        var headers = {
            'Authorization': 'token ' + githubToken,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
        opts = opts || {};
        opts.headers = headers;
        return fetch(url, opts);
    }

    function fileToBase64(file) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function() { resolve(reader.result); };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ---- Utils ----
    function showMsg(id, text, cls) {
        var el = $(id);
        el.textContent = text;
        el.className = 'msg ' + (cls || '');
    }

    function clearMsg(id) {
        var el = $(id);
        el.textContent = '';
        el.className = 'msg';
    }

    function appendLog(container, text, cls) {
        var div = document.createElement('div');
        div.textContent = text;
        if (cls) div.className = cls;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }
})();
