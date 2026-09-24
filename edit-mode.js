/*
 * edit-mode.js — แก้ไขข้อความในหน้าแล้วบันทึกเป็นไฟล์ HTML ใหม่
 *
 * ทำไมต้องดาวน์โหลดไฟล์แทนที่จะบันทึกตรงๆ:
 * หน้าเว็บนี้เป็น static HTML บน GitHub Pages ไม่มี backend ให้เขียนไฟล์กลับ
 * และการฝัง GitHub token ไว้ในหน้าเพื่อ commit เองคือการเปิดเผย credential
 * บน repo สาธารณะ จึงใช้วิธี "แก้ → ดาวน์โหลดไฟล์ใหม่ → วางทับใน repo" แทน
 *
 * ขอบเขตการแก้ไข: เฉพาะ element ที่เป็น "ใบสุดท้ายของข้อความ" (ไม่มี block
 * element ซ้อนข้างใน) เพื่อกันไม่ให้ลบโครงสร้างหน้าเสียหายโดยไม่ตั้งใจ
 * รูปภาพและ SVG ไม่ถูกแตะต้อง
 *
 * เพิ่ม ?edit=1 ต่อท้าย URL ถ้าต้องการให้ปุ่มแสดงเฉพาะตอนที่ต้องการแก้
 * (ดูตัวแปร SHOW_ALWAYS ด้านล่าง)
 */
(function () {
  'use strict';

  /* ตั้งเป็น false ถ้าอยากให้ปุ่มโผล่เฉพาะเมื่อ URL มี ?edit=1 */
  var SHOW_ALWAYS = true;

  /* ลิงก์ไปหน้าแก้ไฟล์บน GitHub — เปลี่ยนได้ถ้าย้าย repo */
  var REPO_UPLOAD_URL = 'https://github.com/Bellepotty97/DORoadmap/upload/main';

  if (!SHOW_ALWAYS && !/[?&]edit=1\b/.test(location.search)) return;

  var UI_ATTR = 'data-edit-ui';

  /* element ระดับ block — ถ้า element ไหนมีลูกเป็นพวกนี้ แปลว่ายังไม่ใช่ใบสุดท้าย */
  var BLOCK = 'address,article,aside,blockquote,details,div,dl,dd,dt,fieldset,' +
              'figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hgroup,hr,' +
              'li,main,nav,ol,p,pre,section,table,tbody,td,tfoot,th,thead,tr,ul';

  var SKIP = /^(SCRIPT|STYLE|SVG|IMG|BR|HR|INPUT|TEXTAREA|SELECT|OPTION|IFRAME|CANVAS|VIDEO|AUDIO|BUTTON)$/;

  var editing = false;
  var dirty = false;
  var originals = null;   /* Map<Element, innerHTML> ไว้ใช้ตอนกดเลิกทำทั้งหมด */

  /* ── หา element ที่ควรแก้ไขได้ ──────────────────────────────────── */
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

  /* ── เข้า / ออก โหมดแก้ไข ───────────────────────────────────────── */
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

  /* ── สร้างไฟล์ HTML ที่สะอาด (ไม่มี UI ของโหมดแก้ไขติดไป) ──────── */
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

  function save() {
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
    showNext(name);
  }

  /* ── หน้าต่างบอกขั้นตอนถัดไปหลังดาวน์โหลด ───────────────────────── */
  function showNext(name) {
    var old = document.getElementById('em-next');
    if (old) old.remove();
    var box = document.createElement('div');
    box.id = 'em-next';
    box.setAttribute(UI_ATTR, '');
    box.innerHTML =
      '<div class="em-next-card">' +
        '<div class="em-next-h">✅ ดาวน์โหลด <code>' + name + '</code> แล้ว</div>' +
        '<div class="em-next-b">' +
          'ไฟล์ที่ได้คือหน้านี้พร้อมข้อความที่แก้แล้ว เปิดดูได้เลย<br>' +
          '<b>หน้าเว็บจริงจะยังไม่เปลี่ยนจนกว่าจะเอาไฟล์นี้ไปวางทับใน repo</b>' +
        '</div>' +
        '<ol class="em-next-l">' +
          '<li>กดปุ่มด้านล่างเพื่อเปิดหน้าอัปโหลดของ GitHub</li>' +
          '<li>ลากไฟล์ <code>' + name + '</code> ที่เพิ่งโหลดเข้าไปวาง</li>' +
          '<li>กด <b>Commit changes</b> แล้วรอ 1–2 นาที ให้ Pages build ใหม่</li>' +
        '</ol>' +
        '<div class="em-next-a">' +
          '<a class="em-btn em-primary" href="' + REPO_UPLOAD_URL + '" target="_blank" rel="noopener">เปิด GitHub เพื่อวางไฟล์ ↗</a>' +
          '<button class="em-btn" type="button" data-em="close-next">ปิด</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(box);
  }

  /* ── แถบเครื่องมือ ──────────────────────────────────────────────── */
  var bar, msgEl, msgTimer;

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
    bar.querySelector('[data-em="save"]').disabled = !dirty;
    bar.querySelector('[data-em="revert"]').disabled = !dirty;
    bar.querySelector('.em-dirty').textContent = dirty ? '● มีการแก้ไขที่ยังไม่บันทึก' : '';
  }

  function buildBar() {
    bar = document.createElement('div');
    bar.setAttribute(UI_ATTR, '');
    bar.innerHTML =
      '<span class="em-dirty"></span>' +
      '<span class="em-msg"></span>' +
      '<button class="em-btn" type="button" data-em="revert">↩ เลิกทำทั้งหมด</button>' +
      '<button class="em-btn em-primary" type="button" data-em="save">💾 บันทึกเป็นไฟล์</button>' +
      '<button class="em-btn em-toggle" type="button" data-em="toggle"></button>';
    document.body.appendChild(bar);
    msgEl = bar.querySelector('.em-msg');

    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-em]');
      if (!b) return;
      var act = b.getAttribute('data-em');
      if (act === 'toggle') { editing ? leave() : enter(); }
      else if (act === 'save') { save(); }
      else if (act === 'revert') { revertAll(); }
    });

    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-em="close-next"]');
      if (b) document.getElementById('em-next').remove();
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
      '  font-family:"Sarabun","IBM Plex Sans Thai",system-ui,sans-serif;}',
      '.em-bar .em-btn{border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);',
      '  color:#fff;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;',
      '  cursor:pointer;font-family:inherit;white-space:nowrap;}',
      '.em-bar .em-btn:hover:not(:disabled){background:rgba(255,255,255,.2);}',
      '.em-bar .em-btn:disabled{opacity:.35;cursor:not-allowed;}',
      '.em-btn.em-primary{background:linear-gradient(135deg,#1565C0,#1E88E5);border-color:transparent;}',
      '.em-btn.em-toggle{background:linear-gradient(135deg,#E65100,#F57C00);border-color:transparent;}',
      '.em-bar .em-dirty{color:#FFB74D;font-size:11px;font-weight:700;}',
      '.em-bar .em-msg{color:#B0BEC5;font-size:11px;max-width:280px;}',
      /* ซ่อนปุ่มบันทึก/เลิกทำตอนยังไม่เข้าโหมดแก้ไข ให้แถบไม่เกะกะ */
      '.em-bar:not(.em-on) [data-em="save"],.em-bar:not(.em-on) [data-em="revert"]{display:none;}',
      /* ไฮไลต์ช่องที่แก้ได้ เฉพาะตอนอยู่ในโหมดแก้ไข */
      'body.em-active [contenteditable="true"]{outline:1px dashed rgba(21,101,192,.45);',
      '  outline-offset:2px;border-radius:3px;}',
      'body.em-active [contenteditable="true"]:hover{background:rgba(21,101,192,.08);}',
      'body.em-active [contenteditable="true"]:focus{outline:2px solid #1565C0;',
      '  background:rgba(21,101,192,.12);}',
      /* หน้าต่างขั้นตอนถัดไป */
      '#em-next{position:fixed;inset:0;z-index:2147483100;background:rgba(0,0,0,.6);',
      '  display:flex;align-items:center;justify-content:center;padding:20px;',
      '  font-family:"Sarabun","IBM Plex Sans Thai",system-ui,sans-serif;}',
      '.em-next-card{background:#fff;color:#1E3A5F;border-radius:14px;max-width:480px;',
      '  width:100%;padding:22px 24px;box-shadow:0 20px 60px rgba(0,0,0,.4);}',
      '.em-next-h{font-size:16px;font-weight:800;margin-bottom:10px;}',
      '.em-next-b{font-size:13px;line-height:1.8;color:#455A64;margin-bottom:12px;}',
      '.em-next-l{font-size:13px;line-height:1.9;color:#37474F;margin:0 0 16px 18px;padding:0;}',
      '.em-next-card code{background:#ECEFF1;border-radius:4px;padding:1px 6px;font-size:12px;}',
      '.em-next-a{display:flex;gap:10px;justify-content:flex-end;}',
      '.em-next-a .em-btn{border:1px solid #CFD8DC;background:#ECEFF1;color:#37474F;',
      '  border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;',
      '  font-family:inherit;text-decoration:none;display:inline-flex;align-items:center;}',
      '.em-next-a .em-primary{background:linear-gradient(135deg,#1565C0,#1E88E5);',
      '  color:#fff;border-color:transparent;}',
      '@media print{.em-bar,#em-next{display:none !important;}}'
    ].join('\n');
    document.head.appendChild(css);
  }

  /* ── ติดตั้ง ─────────────────────────────────────────────────────── */
  function init() {
    styles();
    buildBar();

    document.addEventListener('input', function (e) {
      if (!editing) return;
      if (e.target.closest('[' + UI_ATTR + ']')) return;
      if (!dirty) { dirty = true; render(); }
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
