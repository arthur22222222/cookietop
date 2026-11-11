/* ===========================================================
   Cookie's Top — PWA (service worker + instalação)
   =========================================================== */

(function () {
  'use strict';

  var standalone = false;
  try {
    standalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  } catch (err) { /* ignore */ }

  var isFile = window.location.protocol === 'file:';

  /* ---------- service worker ---------- */

  var pendingWorker = null;

  if ('serviceWorker' in navigator && !isFile) {
    var hadController = !!navigator.serviceWorker.controller;
    var reloading = false;

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; }
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').then(function (registration) {
        if (registration.waiting && navigator.serviceWorker.controller) {
          onUpdateReady(registration.waiting);
        }
        registration.addEventListener('updatefound', function () {
          var worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', function () {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              onUpdateReady(worker);
            }
          });
        });
      }).catch(function (err) {
        console.warn('[PWA] Service worker não registrado:', err);
      });
    });
  } else if (isFile) {
    console.info('[PWA] Abra o app por um servidor (http/https) para habilitar a instalação e o modo offline.');
  }

  /* ---------- botão flutuante ---------- */

  var deferredPrompt = null;
  var installBtn = null;
  var helpDialog = null;

  function onUpdateReady(worker) {
    pendingWorker = worker;
    renderPill();
  }

  function isIOS() {
    var ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function buildInstallButton() {
    if (installBtn) return installBtn;
    installBtn = document.createElement('button');
    installBtn.type = 'button';
    installBtn.className = 'pwa-install';
    installBtn.hidden = true;
    installBtn.innerHTML =
      '<svg class="icon" aria-hidden="true"><use href="#i-download"/></svg>' +
      '<span class="pwa-install-label">Instalar app</span>';
    installBtn.addEventListener('click', onInstallClick);
    document.body.appendChild(installBtn);
    return installBtn;
  }

  function renderPill() {
    if (standalone) {
      if (installBtn) installBtn.hidden = true;
      return;
    }

    var btn = buildInstallButton();
    var mode = '';
    var label = 'Instalar app';

    if (pendingWorker) {
      mode = 'update';
      label = 'Atualizar app';
    } else if (deferredPrompt) {
      mode = 'install';
    } else if (isIOS()) {
      mode = 'ios';
    }

    if (!mode) {
      btn.hidden = true;
      return;
    }

    btn.dataset.mode = mode;
    var text = btn.querySelector('.pwa-install-label');
    if (text) text.textContent = label;
    btn.hidden = false;
  }

  function onInstallClick() {
    var mode = installBtn && installBtn.dataset.mode;

    if (mode === 'update') {
      if (pendingWorker) pendingWorker.postMessage({ type: 'SKIP_WAITING' });
      return;
    }

    if (mode === 'install' && deferredPrompt) {
      var prompt = deferredPrompt;
      deferredPrompt = null;
      prompt.prompt();
      prompt.userChoice.then(function (choice) {
        if (choice && choice.outcome === 'accepted') {
          if (installBtn) installBtn.hidden = true;
        } else {
          renderPill();
        }
      }).catch(function () { renderPill(); });
      return;
    }

    openHelp();
  }

  /* ---------- diálogo de ajuda ---------- */

  function buildHelp() {
    if (helpDialog) return helpDialog;

    helpDialog = document.createElement('div');
    helpDialog.className = 'pwa-help';
    helpDialog.hidden = true;
    helpDialog.innerHTML =
      '<div class="pwa-help-card" role="dialog" aria-modal="true" aria-labelledby="pwa-help-title">' +
        '<h2 id="pwa-help-title">Instalar o Cookie\'s Top</h2>' +
        '<p class="pwa-help-sub">Assim o painel abre em tela cheia, com ícone próprio, e funciona sem internet.</p>' +
        '<p class="pwa-help-step-title">iPhone / iPad (Safari)</p>' +
        '<ol>' +
          '<li>Toque em <strong>Compartilhar</strong> (o quadrado com a seta para cima).</li>' +
          '<li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>' +
          '<li>Confirme em <strong>Adicionar</strong>.</li>' +
        '</ol>' +
        '<p class="pwa-help-step-title">Android (Chrome)</p>' +
        '<ol>' +
          '<li>Abra o menu <strong>⋮</strong> no canto do navegador.</li>' +
          '<li>Toque em <strong>Instalar app</strong> (ou “Adicionar à tela inicial”).</li>' +
        '</ol>' +
        '<p class="pwa-help-note">A instalação só funciona com o site publicado em <strong>HTTPS</strong> (ou aberto em <code>localhost</code>).</p>' +
        '<button type="button" class="btn btn-primary btn-block" data-pwa-close>Entendi</button>' +
      '</div>';

    helpDialog.addEventListener('click', function (event) {
      if (event.target === helpDialog || event.target.closest('[data-pwa-close]')) {
        closeHelp();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && helpDialog && !helpDialog.hidden) closeHelp();
    });

    document.body.appendChild(helpDialog);
    return helpDialog;
  }

  function openHelp() {
    var dialog = buildHelp();
    dialog.hidden = false;
    requestAnimationFrame(function () { dialog.classList.add('is-open'); });
    var close = dialog.querySelector('[data-pwa-close]');
    if (close) close.focus();
  }

  function closeHelp() {
    if (!helpDialog) return;
    helpDialog.classList.remove('is-open');
    helpDialog.hidden = true;
  }

  /* ---------- eventos de instalação ---------- */

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    renderPill();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    if (installBtn) installBtn.hidden = true;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderPill);
  } else {
    renderPill();
  }
})();
