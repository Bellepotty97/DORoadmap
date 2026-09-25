/*
 * edit-mode.js — แก้ไขข้อความในหน้า แล้วบันทึกเป็นไฟล์ หรือ publish ขึ้นเว็บโดยตรง
 *
 * ── เรื่อง token ──────────────────────────────────────────────────────
 * ไฟล์นี้ "ไม่มี" GitHub token ฝังอยู่ และต้องไม่มีตลอดไป เหตุผล:
 *   1. repo เป็น public — ใครก็อ่านไฟล์นี้ได้ ต่อให้เข้ารหัสไว้ก็เปิด
 *      DevTools ดู header ของ request ได้อยู่ดี
 *   2. GitHub secret scanning จะ revoke token ที่เจอใน public repo อัตโนมัติ
 *      ฝังไปก็ใช้ได้ไม่กี่นาที
 *   3. สิทธิ์ต่ำสุดที่ commit ได้คือ Contents:RW ซึ่งให้คนแทรก JavaScript
 *      ลงหน้านี้ได้ — สคริปต์นั้นจะรันในเบราว์เซอร์ทุกคนที่เปิดลิงก์
 *
 * จึงใช้วิธี: ให้คนที่จะแก้ "กรอก token ของตัวเอง" ตอนกด publish
 * token อยู่แค่ในหน่วยความจำของเบราว์เซอร์คนนั้น (เลือกเก็บใน sessionStorage
 * ได้ = ปิดแท็บแล้วหาย) ไม่เคยถูกเขียนลงไฟล์ และส่งไปที่ api.github.com เท่านั้น
 *
 * Token ที่ต้องใช้ — Fine-grained PAT ขอบเขตแคบที่สุดที่ commit ได้:
 *   Repository access : Only select repositories -> DORoadmap
 *   Permissions       : Contents = Read and write   (อย่างอื่น No access)
 *   Expiration        : 30 วัน
 *
 * ── ขอบเขตการแก้ไข ───────────────────────────────────────────────────
 * แก้ได้เฉพาะ element ที่เป็น "ใบสุดท้ายของข้อความ" (ไม่มี block element
 * ซ้อนข้างใน) เพื่อกันการลบโครงสร้างหน้าเสียหายโดยไม่ตั้งใจ
 * รูปภาพและ SVG ไม่ถูกแตะต้อง
 */
(function () {
  'use strict';

  /* ตั้งเป็น false ถ้าอยากให้ปุ่มโผล่เฉพาะเมื่อ URL มี ?edit=1 */
  var SHOW_ALWAYS = true;

  /* ปลายทางที่จะ commit — แก้ตรงนี้ถ้าย้าย repo หรือเปลี่ยน branch */
  var REPO = { owner: 'Bellepotty97', repo: 'DORoadmap', branch: 'main' };

  var TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';
  var TOKEN_KEY = 'do_gh_token';

  if (!SHOW_ALWAYS && !/[?&]edit=1\b/.test(location.search)) return;

  var UI_ATTR = 'data-edit-ui';

  /* element ระดับ block — ถ้ามีลูกเป็นพวกนี้ แปลว่ายังไม่ใช่ใบสุดท้ายของข้อความ */
  var BLOCK = 'address,article,aside,blockquote,details,div,dl,dd,dt,fieldset,' +
              'figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hgroup,hr,' +
              'li,main,nav,ol,p,pre,section,table,tbody,td,tfoot,th,thead,tr,ul';

  var SKIP = /^(SCRIPT|STYLE|SVG|IMG|BR|HR|INPUT|TEXTAREA|SELECT|OPTION|IFRAME|CANVAS|VIDEO|AUDIO|BUTTON)$/;

  var editing = false;
  var dirty = false;
  var originals = null;   /* Map<Element, innerHTML> ไว้ใช้ตอนกดเลิกทำทั้งหมด */

  /* ═══ ส่วนที่ 1: โหมดแก้ไข ═════════════════════════════════════════ */

  function collectTargets() {
    var out = [];
    var all = document.body.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (SKIP.test(el.tagName)) continue;
      if (el.closest('[' + UI_ATTR + ']')) continue;
      if (el.querySelector(BLOCK)) continue;            /* ยังมี block ซ้อน */
      if (!el.textContent.trim()) continue;             /* ไม่มีข้อความ */
      /* ข้ามถ้ามีบรรพบุรุษถูกเลือกไปแล้ว — กัน contenteditable ซ้อนกัน */
      var nested = false;
      for (var j = 0; j < out.length; j++) {
        if (out[j].contains(el)) { nested = true; break; }
      }
      if (nested) continue;
      out.push(el);
    }
    return out;
  }

  function enter() {
    var targets = collectTargets();
    originals = new Map();
    targets.forEach(function (el) {
      originals.set(el, el.innerHTML);
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
    });
    editing = true;
    document.body.classList.add('em-active');
    render();
    status(targets.length + ' จุดที่แก้ไขได้ — คลิกที่ข้อความเพื่อพิมพ์');
  }

  function leave() {
    document.querySelectorAll('[contenteditable]').forEach(function (el) {
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
    });
    editing = false;
    document.body.classList.remove('em-active');
    render();
  }

  function revertAll() {
    if (!originals) return;
    originals.forEach(function (html, el) { el.innerHTML = html; });
    dirty = false;
    render();
    status('ย้อนกลับเป็นข้อความเดิมทั้งหมดแล้ว');
  }

  /* ═══ ส่วนที่ 2: สร้างไฟล์ HTML ที่สะอาด ═══════════════════════════ */

  function serialize() {
    var clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('[' + UI_ATTR + ']').forEach(function (n) { n.remove(); });
    clone.querySelectorAll('[contenteditable]').forEach(function (n) {
      n.removeAttribute('contenteditable');
      n.removeAttribute('spellcheck');
    });
    var body = clone.querySelector('body');
    if (body) body.classList.remove('em-active');
    return '<!DOCTYPE html>\n' + clone.outerHTML + '\n';
  }

  function currentFileName() {
    var name = location.pathname.split('/').pop();
    return (name && /\.html?$/i.test(name)) ? name : 'index.html';
  }

  /* path ของไฟล์นี้เทียบกับรากของ repo
     บน Pages โครงสร้างคือ /<repo>/<path> จึงต้องตัดชื่อ repo ออก */
  function repoPath() {
    var p = location.pathname.replace(/^\/+/, '');
    var prefix = REPO.repo + '/';
    if (p.toLowerCase().indexOf(prefix.toLowerCase()) === 0) p = p.slice(prefix.length);
    if (!p || p.slice(-1) === '/') p += 'index.html';
    return p;
  }

  function download() {
    var name = currentFileName();
    var blob = new Blob([serialize()], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    /* คืนหน่วยความจำ — ต้องรอให้เบราว์เซอร์เริ่มดาวน์โหลดก่อน */
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    dirty = false;
    render();
    modal(
      '✅ ดาวน์โหลด <code>' + esc(name) + '</code> แล้ว',
      '<p>ไฟล์ที่ได้คือหน้านี้พร้อมข้อความที่แก้แล้ว<br>' +
      '<b>หน้าเว็บจริงจะยังไม่เปลี่ยนจนกว่าจะเอาไฟล์นี้ไปวางทับใน repo</b></p>' +
      '<ol><li>เปิดหน้าอัปโหลดของ GitHub</li>' +
      '<li>ลากไฟล์ <code>' + esc(name) + '</code> เข้าไปวาง</li>' +
      '<li>กด <b>Commit changes</b> แล้วรอ Pages build 1–2 นาที</li></ol>',
      [{ label: 'เปิด GitHub เพื่อวางไฟล์ ↗', primary: true,
         href: 'https://github.com/' + REPO.owner + '/' + REPO.repo + '/upload/' + REPO.branch },
       { label: 'ปิด' }]
    );
  }

  /* ═══ ส่วนที่ 3: publish ขึ้น GitHub โดยตรง ════════════════════════ */

  /* btoa รับได้เฉพาะ binary string จึงต้องแปลง UTF-8 เป็น byte ก่อน
     และต้องแบ่งเป็นก้อน ไม่งั้น apply จะ stack overflow กับไฟล์ใหญ่ */
  function toBase64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    var CHUNK = 0x8000;
    for (var i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t, remember) {
    if (!remember) return;
    try { sessionStorage.setItem(TOKEN_KEY, t); } catch (e) { /* โหมดส่วนตัว */ }
  }
  function forgetToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ไม่เป็นไร */ }
  }

  function api(path, token, options) {
    var opts = options || {};
    opts.headers = Object.assign({
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28'
    }, opts.headers || {});
    return fetch('https://api.github.com' + path, opts);
  }

  /* stage: 'read' = ตอนดึง sha, 'write' = ตอน commit
     GitHub ส่ง header x-accepted-github-permissions มาบอกตรงๆ ว่าต้องการสิทธิ์อะไร
     จึงแสดงทั้ง header นั้นและ message ดิบของ GitHub ไว้ด้วย เพื่อให้วินิจฉัยได้จริง */
  function friendlyError(res, body, stage) {
    var need = res.headers.get('x-accepted-github-permissions') || '';
    var raw  = (body && body.message) ? body.message : '';
    var msg;

    if (res.status === 401) {
      msg = 'Token ไม่ถูกต้องหรือหมดอายุแล้ว — สร้างใหม่แล้วลองอีกครั้ง';
    } else if (res.status === 403) {
      msg = stage === 'write'
        ? 'Token อ่าน repo ได้ แต่เขียนไม่ได้ — สิทธิ์ Contents ยังเป็น Read-only ' +
          'ต้องเปลี่ยนเป็น Read and write แล้วกด Update token'
        : 'Token ใช้ได้ แต่สิทธิ์ไม่พอสำหรับ repo นี้';
    } else if (res.status === 404) {
      msg = 'หาไฟล์หรือ repo ไม่เจอ — token อาจไม่ได้เลือก repo นี้ไว้ ' +
            '(ตั้ง Only select repositories → ' + REPO.repo + ')';
    } else if (res.status === 409 || res.status === 422) {
      msg = 'ไฟล์บน GitHub ถูกแก้ไปแล้วหลังจากคุณเปิดหน้านี้ — รีโหลดหน้าแล้วแก้ใหม่ เพื่อไม่ให้ทับงานคนอื่น';
    } else {
      msg = 'GitHub ตอบกลับ ' + res.status;
    }

    var detail = [];
    if (raw) detail.push('GitHub: ' + raw);
    if (need) detail.push('สิทธิ์ที่ GitHub ต้องการ: ' + need);
    detail.push('ขั้นตอน: ' + (stage === 'write' ? 'commit (PUT)' : 'อ่านไฟล์ (GET)') + ' · HTTP ' + res.status);
    return msg + '\n\u0000' + detail.join('\n');
  }

  async function publish(token, remember) {
    var path = repoPath();
    var base = '/repos/' + REPO.owner + '/' + REPO.repo + '/contents/' + path;
    busy(true, 'กำลังตรวจไฟล์ปัจจุบันบน GitHub…');

    try {
      /* 1) ขอ sha ของไฟล์ปัจจุบัน — GitHub ใช้ตรวจว่าเราเขียนทับของเก่าจริง */
      var getRes = await api(base + '?ref=' + encodeURIComponent(REPO.branch), token, { cache: 'no-store' });
      if (!getRes.ok) {
        var gb = await getRes.json().catch(function () { return null; });
        throw new Error(friendlyError(getRes, gb, 'read'));
      }
      var meta = await getRes.json();

      /* 2) เขียนทับ พร้อมแนบ sha เดิม — ถ้า sha ไม่ตรง GitHub จะปฏิเสธ */
      busy(true, 'กำลัง commit ขึ้น ' + REPO.branch + '…');
      var putRes = await api(base, token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Edit ' + path + ' from in-page editor',
          content: toBase64(serialize()),
          sha: meta.sha,
          branch: REPO.branch
        })
      });
      var pb = await putRes.json().catch(function () { return null; });
      if (!putRes.ok) throw new Error(friendlyError(putRes, pb, 'write'));

      setToken(token, remember);
      dirty = false;
      busy(false);
      render();

      var commitUrl = pb && pb.commit && pb.commit.html_url;
      modal(
        '🚀 เผยแพร่ขึ้นเว็บแล้ว',
        '<p>commit ไฟล์ <code>' + esc(path) + '</code> ขึ้น branch <code>' + esc(REPO.branch) + '</code> เรียบร้อย</p>' +
        '<p><b>รอ 1–2 นาที</b> ให้ GitHub Pages build ใหม่ แล้วรีโหลดหน้านี้จะเห็นข้อความที่แก้</p>',
        [ commitUrl ? { label: 'ดู commit ↗', href: commitUrl } : null,
          { label: 'เสร็จแล้ว', primary: true } ].filter(Boolean)
      );
    } catch (err) {
      busy(false);
      var parts = String(err.message).split('\u0000');
      modal('❌ เผยแพร่ไม่สำเร็จ',
        '<p class="em-err">' + esc(parts[0]) + '</p>' +
        (parts[1] ? '<pre class="em-detail">' + esc(parts[1]) + '</pre>' : '') +
        '<p>ข้อความที่แก้ยังอยู่ในหน้านี้ ไม่หายไปไหน — แก้ปัญหาแล้วกดเผยแพร่ใหม่ได้ ' +
        'หรือกด <b>บันทึกเป็นไฟล์</b> เก็บไว้ก่อน</p>',
        [{ label: '🔍 ตรวจสอบ token', keep: true, onClick: function () {
             var t = getToken();
             if (t) { closeModal(); diagnose(t); }
             else { closeModal(); askTokenFor(diagnose); }
           } },
         { label: 'เปิดหน้าตั้งค่า token ↗',
           href: 'https://github.com/settings/personal-access-tokens' },
         { label: 'ปิด', primary: true }]);
    }
  }

  /* ตรวจว่า token ติดปัญหาอะไรกันแน่ — เดาจาก 403 อย่างเดียวไม่พอ เพราะ
     repo นี้เป็น public การ GET จึงสำเร็จได้แม้ token ไม่ได้เลือก repo นี้ไว้
     ตัวชี้ขาดคือ permissions.push จาก /repos/{owner}/{repo} */
  async function diagnose(token) {
    busy(true, 'กำลังตรวจสอบ token…');
    try {
      var uRes = await api('/user', token, { cache: 'no-store' });
      if (uRes.status === 401) {
        busy(false);
        return verdict('C', 'Token ใช้ไม่ได้', [
          ['Token valid', 'ไม่ — GitHub ตอบ 401', false]
        ], 'token ผิด คัดลอกไม่ครบ หรือหมดอายุแล้ว — สร้างใหม่');
      }
      var u = await uRes.json();
      var isClassic = /^gh[pousr]_/.test(token);

      var rRes = await api('/repos/' + REPO.owner + '/' + REPO.repo, token, { cache: 'no-store' });
      var r = await rRes.json().catch(function () { return {}; });
      var perms = r.permissions || {};
      var canPush = !!perms.push;

      busy(false);
      var rows = [
        ['Token ใช้งานได้', 'ใช่ — เป็นของ @' + u.login, true],
        ['ชนิด token', isClassic ? 'Classic (ไม่แนะนำ)' : 'Fine-grained', !isClassic],
        ['เห็น repo ' + REPO.repo, rRes.ok ? 'ใช่' : 'ไม่ (HTTP ' + rRes.status + ')', rRes.ok],
        ['เขียน repo ได้ (push)', canPush ? 'ใช่' : 'ไม่ ← สาเหตุอยู่ตรงนี้', canPush]
      ];

      if (canPush) {
        return verdict('OK', 'Token พร้อมใช้งาน', rows,
          'สิทธิ์ครบแล้ว ลองกดเผยแพร่อีกครั้งได้เลย ' +
          'ถ้ายังไม่ผ่าน แปลว่าเป็นปัญหาอื่น ไม่ใช่เรื่องสิทธิ์');
      }
      if (isClassic) {
        return verdict('C', 'ใช้ Classic token อยู่', rows,
          'Classic token ต้องติ๊ก scope ถึงจะเขียนได้ — repo นี้เป็น public จึงใช้ ' +
          '<b>public_repo</b> พอ (แคบกว่า <b>repo</b> ที่ให้สิทธิ์ private ด้วย)<br>' +
          'ถ้าเลือกได้ แนะนำ Fine-grained มากกว่า เพราะจำกัดได้ทีละ repo');
      }
      return verdict('AB', 'Token เขียน repo นี้ไม่ได้', rows,
        'เกิดได้ 2 กรณี ตรวจทั้งคู่ที่หน้าตั้งค่า token:<br>' +
        '<b>1.</b> Repository access ต้องเป็น <b>Only select repositories</b> ' +
        'และติ๊ก <code>' + esc(REPO.repo) + '</code> ไว้จริง<br>' +
        '<b>2.</b> Repository permissions → <code>Contents</code> ต้องเป็น ' +
        '<b>Read and write</b> (ไม่ใช่ Read-only)<br>' +
        'แก้แล้วอย่าลืมกด <b>Update token</b> ล่างสุด');
    } catch (e) {
      busy(false);
      return verdict('C', 'ตรวจสอบไม่สำเร็จ',
        [['เชื่อมต่อ api.github.com', 'ไม่สำเร็จ', false]], esc(e.message));
    }
  }

  function verdict(kind, title, rows, advice) {
    var ok = kind === 'OK';
    var html = '<table class="em-diag">' + rows.map(function (r) {
      return '<tr><td>' + esc(r[0]) + '</td><td class="' + (r[2] ? 'em-ok' : 'em-no') + '">' +
             (r[2] ? '✅ ' : '❌ ') + esc(r[1]) + '</td></tr>';
    }).join('') + '</table><p class="em-advice">' + advice + '</p>';
    modal((ok ? '✅ ' : '🔍 ') + esc(title), html,
      [{ label: 'เปิดหน้าตั้งค่า token ↗',
         href: 'https://github.com/settings/personal-access-tokens' },
       { label: 'ปิด', primary: true }]);
  }

  function askTokenThenPublish() {
    var saved = getToken();
    if (saved) { publish(saved, true); return; }
    askTokenFor(publish);

  }

  function askTokenFor(then) {
    modal(
      '🔑 ใส่ GitHub Token',
      '<p>หน้านี้อยู่บน static hosting จึงต้องใช้ token ของคุณเองในการ commit<br>' +
      '<b>token ไม่ถูกบันทึกลงไฟล์ใดๆ</b> และส่งไปที่ <code>api.github.com</code> เท่านั้น</p>' +
      '<div class="em-field">' +
        '<input type="password" id="em-token" placeholder="github_pat_…" autocomplete="off" spellcheck="false">' +
        '<label class="em-check"><input type="checkbox" id="em-remember" checked> จำไว้จนกว่าจะปิดแท็บ</label>' +
      '</div>' +
      '<details class="em-help"><summary>วิธีสร้าง token แบบจำกัดสิทธิ์ที่สุด</summary>' +
        '<ol>' +
        '<li>เลือกชนิด <b>Fine-grained</b> (อย่าใช้ Classic — ให้สิทธิ์ทุก repo)</li>' +
        '<li>Repository access → <b>Only select repositories</b> → <code>' + esc(REPO.repo) + '</code></li>' +
        '<li>Permissions → <b>Contents = Read and write</b> อย่างเดียว ที่เหลือ No access</li>' +
        '<li>Expiration → <b>30 วัน</b></li>' +
        '</ol></details>',
      [{ label: 'สร้าง token ↗', href: TOKEN_URL },
       { label: 'ยกเลิก' },
       { label: 'เผยแพร่', primary: true, keep: true, onClick: function (box) {
           var t = box.querySelector('#em-token').value.trim();
           var r = box.querySelector('#em-remember').checked;
           if (!t) { box.querySelector('#em-token').focus(); return; }
           closeModal();
           then(t, r);
         } }]
    );
    var inp = document.querySelector('#em-token');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var box = document.querySelector('.em-modal-card');
          var t = inp.value.trim();
          if (!t) return;
          var r = box.querySelector('#em-remember').checked;
          closeModal();
          then(t, r);
        }
      });
    }
  }

  /* ═══ ส่วนที่ 4: UI ════════════════════════════════════════════════ */

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function closeModal() {
    var m = document.getElementById('em-modal');
    if (m) m.remove();
  }

  /* buttons: [{label, primary?, href?, onClick?, keep?}] — keep = ไม่ปิด modal เอง */
  function modal(title, bodyHtml, buttons) {
    closeModal();
    var wrap = document.createElement('div');
    wrap.id = 'em-modal';
    wrap.setAttribute(UI_ATTR, '');
    var card = document.createElement('div');
    card.className = 'em-modal-card';
    card.innerHTML = '<div class="em-modal-h">' + title + '</div>' +
                     '<div class="em-modal-b">' + bodyHtml + '</div>';
    var acts = document.createElement('div');
    acts.className = 'em-modal-a';
    (buttons || []).forEach(function (b) {
      var el;
      if (b.href) {
        el = document.createElement('a');
        el.href = b.href; el.target = '_blank'; el.rel = 'noopener';
      } else {
        el = document.createElement('button');
        el.type = 'button';
      }
      el.className = 'em-btn' + (b.primary ? ' em-primary' : '');
      el.textContent = b.label;
      el.addEventListener('click', function () {
        if (b.onClick) b.onClick(card);
        else if (!b.keep && !b.href) closeModal();
      });
      acts.appendChild(el);
    });
    card.appendChild(acts);
    wrap.appendChild(card);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeModal(); });
    document.body.appendChild(wrap);
    return card;
  }

  var bar, msgEl, msgTimer, busyEl;

  function busy(on, text) {
    if (on) {
      closeModal();
      if (!busyEl) {
        busyEl = document.createElement('div');
        busyEl.id = 'em-busy';
        busyEl.setAttribute(UI_ATTR, '');
        document.body.appendChild(busyEl);
      }
      busyEl.innerHTML = '<div class="em-busy-card"><span class="em-spin"></span>' + esc(text || 'กำลังทำงาน…') + '</div>';
      busyEl.style.display = 'flex';
    } else if (busyEl) {
      busyEl.style.display = 'none';
    }
  }

  function status(text) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    clearTimeout(msgTimer);
    if (text) msgTimer = setTimeout(function () { msgEl.textContent = ''; }, 4000);
  }

  function render() {
    if (!bar) return;
    bar.className = 'em-bar' + (editing ? ' em-on' : '');
    bar.querySelector('[data-em="toggle"]').textContent = editing ? '✕ ออกจากโหมดแก้ไข' : '✏️ แก้ไขข้อความ';
    ['save', 'publish', 'revert'].forEach(function (k) {
      bar.querySelector('[data-em="' + k + '"]').disabled = !dirty;
    });
    bar.querySelector('[data-em="forget"]').style.display = getToken() ? '' : 'none';
    bar.querySelector('.em-dirty').textContent = dirty ? '● ยังไม่บันทึก' : '';
  }

  function buildBar() {
    bar = document.createElement('div');
    bar.setAttribute(UI_ATTR, '');
    bar.innerHTML =
      '<span class="em-dirty"></span>' +
      '<span class="em-msg"></span>' +
      '<button class="em-btn" type="button" data-em="forget" title="ลบ token ออกจากเบราว์เซอร์">🔓 ลืม token</button>' +
      '<button class="em-btn" type="button" data-em="check" title="ตรวจว่า token มีสิทธิ์พอไหม">🔍 ตรวจสอบ token</button>' +
      '<button class="em-btn" type="button" data-em="revert">↩ เลิกทำทั้งหมด</button>' +
      '<button class="em-btn" type="button" data-em="save">💾 บันทึกเป็นไฟล์</button>' +
      '<button class="em-btn em-primary" type="button" data-em="publish">🚀 เผยแพร่ขึ้นเว็บ</button>' +
      '<button class="em-btn em-toggle" type="button" data-em="toggle"></button>';
    document.body.appendChild(bar);
    msgEl = bar.querySelector('.em-msg');

    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-em]');
      if (!b || b.disabled) return;
      var act = b.getAttribute('data-em');
      if (act === 'toggle') { editing ? leave() : enter(); }
      else if (act === 'save') { download(); }
      else if (act === 'publish') { askTokenThenPublish(); }
      else if (act === 'check') { var t = getToken(); t ? diagnose(t) : askTokenFor(diagnose); }
      else if (act === 'revert') { revertAll(); }
      else if (act === 'forget') { forgetToken(); render(); status('ลบ token ออกจากเบราว์เซอร์แล้ว'); }
    });

    render();
  }

  function styles() {
    var css = document.createElement('style');
    css.setAttribute(UI_ATTR, '');
    css.textContent = [
      '.em-bar{position:fixed;right:16px;bottom:16px;z-index:2147483000;',
      '  display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:12px;',
      '  background:rgba(13,27,62,.95);border:1px solid rgba(255,255,255,.18);',
      '  box-shadow:0 8px 28px rgba(0,0,0,.45);backdrop-filter:blur(6px);',
      '  font-family:"Sarabun","IBM Plex Sans Thai",system-ui,sans-serif;flex-wrap:wrap;',
      '  max-width:calc(100vw - 32px);justify-content:flex-end;}',
      '.em-btn{border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);',
      '  color:#fff;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;',
      '  cursor:pointer;font-family:inherit;white-space:nowrap;text-decoration:none;',
      '  display:inline-flex;align-items:center;}',
      '.em-bar .em-btn:hover:not(:disabled){background:rgba(255,255,255,.2);}',
      '.em-btn:disabled{opacity:.35;cursor:not-allowed;}',
      '.em-bar .em-primary{background:linear-gradient(135deg,#2E7D32,#43A047);border-color:transparent;}',
      '.em-btn.em-toggle{background:linear-gradient(135deg,#E65100,#F57C00);border-color:transparent;}',
      '.em-bar .em-dirty{color:#FFB74D;font-size:11px;font-weight:700;}',
      '.em-bar .em-msg{color:#B0BEC5;font-size:11px;max-width:260px;}',
      /* ตอนยังไม่เข้าโหมดแก้ไข แสดงเฉพาะปุ่มเปิดโหมด */
      '.em-bar:not(.em-on) [data-em="save"],.em-bar:not(.em-on) [data-em="publish"],',
      '.em-bar:not(.em-on) [data-em="revert"],.em-bar:not(.em-on) [data-em="forget"],',
      '.em-bar:not(.em-on) [data-em="check"]{display:none !important;}',
      /* ไฮไลต์ช่องที่แก้ได้ */
      'body.em-active [contenteditable="true"]{outline:1px dashed rgba(21,101,192,.45);',
      '  outline-offset:2px;border-radius:3px;}',
      'body.em-active [contenteditable="true"]:hover{background:rgba(21,101,192,.08);}',
      'body.em-active [contenteditable="true"]:focus{outline:2px solid #1565C0;',
      '  background:rgba(21,101,192,.12);}',
      /* modal */
      '#em-modal{position:fixed;inset:0;z-index:2147483100;background:rgba(0,0,0,.6);',
      '  display:flex;align-items:center;justify-content:center;padding:20px;',
      '  font-family:"Sarabun","IBM Plex Sans Thai",system-ui,sans-serif;}',
      '.em-modal-card{background:#fff;color:#1E3A5F;border-radius:14px;max-width:500px;',
      '  width:100%;padding:22px 24px;box-shadow:0 20px 60px rgba(0,0,0,.4);',
      '  max-height:85vh;overflow-y:auto;}',
      '.em-modal-h{font-size:16px;font-weight:800;margin-bottom:10px;}',
      '.em-modal-b{font-size:13px;line-height:1.8;color:#455A64;}',
      '.em-modal-b p{margin:0 0 10px;}',
      '.em-modal-b ol{margin:0 0 10px 18px;padding:0;line-height:1.9;}',
      '.em-modal-card code{background:#ECEFF1;border-radius:4px;padding:1px 6px;font-size:12px;}',
      '.em-err{background:#FFEBEE;border-left:3px solid #C62828;color:#B71C1C;',
      '  padding:10px 12px;border-radius:6px;font-weight:600;}',
      '.em-detail{background:#263238;color:#B2DFDB;border-radius:6px;padding:10px 12px;',
'  font-size:11px;line-height:1.7;white-space:pre-wrap;word-break:break-word;',
'  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin:0 0 10px;}',
      '.em-diag{width:100%;border-collapse:collapse;margin:4px 0 12px;font-size:12.5px;}',
'.em-diag td{padding:7px 8px;border-bottom:1px solid #ECEFF1;vertical-align:top;}',
'.em-diag td:first-child{color:#607D8B;white-space:nowrap;}',
'.em-diag .em-ok{color:#2E7D32;font-weight:700;}',
'.em-diag .em-no{color:#C62828;font-weight:700;}',
'.em-advice{background:#FFF8E1;border-left:3px solid #F57C00;padding:10px 12px;',
'  border-radius:6px;font-size:12.5px;line-height:1.8;}',
      '.em-field{margin:12px 0;}',
      '#em-token{width:100%;padding:10px 12px;border:1.5px solid #CFD8DC;border-radius:8px;',
      '  font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;box-sizing:border-box;}',
      '#em-token:focus{outline:none;border-color:#1565C0;}',
      '.em-check{display:flex;align-items:center;gap:7px;margin-top:9px;font-size:12px;color:#546E7A;}',
      '.em-help{margin-top:6px;font-size:12px;}',
      '.em-help summary{cursor:pointer;color:#1565C0;font-weight:700;}',
      '.em-help ol{margin:8px 0 0 18px;}',
      '.em-modal-a{display:flex;gap:10px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap;}',
      '.em-modal-a .em-btn{border:1px solid #CFD8DC;background:#ECEFF1;color:#37474F;',
      '  padding:8px 16px;font-size:13px;}',
      '.em-modal-a .em-btn:hover{background:#CFD8DC;}',
      '.em-modal-a .em-primary{background:linear-gradient(135deg,#2E7D32,#43A047);',
      '  color:#fff;border-color:transparent;}',
      /* busy */
      '#em-busy{position:fixed;inset:0;z-index:2147483200;background:rgba(0,0,0,.55);',
      '  display:flex;align-items:center;justify-content:center;',
      '  font-family:"Sarabun","IBM Plex Sans Thai",system-ui,sans-serif;}',
      '.em-busy-card{background:#fff;color:#1E3A5F;border-radius:12px;padding:18px 24px;',
      '  font-size:13px;font-weight:700;display:flex;align-items:center;gap:12px;}',
      '.em-spin{width:16px;height:16px;border:2px solid #CFD8DC;border-top-color:#1565C0;',
      '  border-radius:50%;animation:em-rot .8s linear infinite;flex-shrink:0;}',
      '@keyframes em-rot{to{transform:rotate(360deg);}}',
      '@media print{.em-bar,#em-modal,#em-busy{display:none !important;}}'
    ].join('\n');
    document.head.appendChild(css);
  }

  /* ═══ ติดตั้ง ══════════════════════════════════════════════════════ */

  function init() {
    styles();
    buildBar();

    document.addEventListener('input', function (e) {
      if (!editing) return;
      if (e.target.closest('[' + UI_ATTR + ']')) return;
      if (!dirty) { dirty = true; render(); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    window.addEventListener('beforeunload', function (e) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
