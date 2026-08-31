(function () {
  'use strict';

  function setupSignaturePad(container) {
    const canvas = container.querySelector('canvas');
    const targetName = container.dataset.target;
    const hiddenInput = container.parentElement.querySelector('input[type="hidden"][name="' + targetName + '"]');
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let hasDrawn = false;

    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0A0A0C';

    function pointerPos(evt) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY,
      };
    }

    function start(evt) {
      drawing = true;
      hasDrawn = true;
      const p = pointerPos(evt);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      evt.preventDefault();
    }

    function move(evt) {
      if (!drawing) return;
      const p = pointerPos(evt);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      evt.preventDefault();
    }

    function end() {
      if (!drawing) return;
      drawing = false;
      if (hiddenInput && hasDrawn) hiddenInput.value = canvas.toDataURL('image/png');
    }

    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    canvas.addEventListener('pointerleave', end);

    const clearBtn = container.parentElement.querySelector('.signature-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasDrawn = false;
        if (hiddenInput) hiddenInput.value = '';
      });
    }

    // Pré-remplissage si une signature existe déjà (mode édition)
    if (hiddenInput && hiddenInput.value) {
      const img = new Image();
      img.onload = function () {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = hiddenInput.value;
    }
  }

  document.querySelectorAll('.signature-pad').forEach(setupSignaturePad);

  document.querySelectorAll('[data-copy-target]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const input = document.getElementById(btn.dataset.copyTarget);
      if (!input) return;
      input.select();
      const finish = function (ok) {
        const original = btn.textContent;
        btn.textContent = ok ? 'Copié !' : 'Échec de la copie';
        setTimeout(function () {
          btn.textContent = original;
        }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(input.value).then(function () {
          finish(true);
        }, function () {
          finish(false);
        });
      } else {
        try {
          document.execCommand('copy');
          finish(true);
        } catch (e) {
          finish(false);
        }
      }
    });
  });

  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (evt) {
      if (!window.confirm(form.dataset.confirm)) evt.preventDefault();
    });
  });

  const clientSection = document.getElementById('client-section');
  if (clientSection) {
    const radios = clientSection.querySelectorAll('input[name="client_mode"]');
    const panels = clientSection.querySelectorAll('[data-client-panel]');
    const internalFlag = document.getElementById('is_internal_flag');

    function applyClientMode(mode) {
      panels.forEach(function (panel) {
        const active = panel.dataset.clientPanel === mode;
        panel.classList.toggle('hidden', !active);
        panel.querySelectorAll('input, select, textarea').forEach(function (el) {
          el.disabled = !active;
        });
      });
      if (internalFlag) internalFlag.checked = mode === 'internal';

      const sigBlock = document.getElementById('client-signature-block');
      if (sigBlock) {
        const internal = mode === 'internal';
        sigBlock.classList.toggle('hidden', internal);
        sigBlock.querySelectorAll('input').forEach(function (el) {
          el.disabled = internal;
        });
      }
    }

    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.checked) applyClientMode(radio.value);
      });
    });

    const initial = clientSection.querySelector('input[name="client_mode"]:checked');
    applyClientMode(initial ? initial.value : 'registered');
  }

  const detoursList = document.getElementById('detours-list');
  const addDetourBtn = document.getElementById('add-detour');
  if (detoursList && addDetourBtn) {
    function bindRemove(row) {
      const btn = row.querySelector('.detour-remove');
      btn.addEventListener('click', function () {
        if (detoursList.querySelectorAll('.detour-row').length > 1) {
          row.remove();
        } else {
          row.querySelector('input').value = '';
        }
      });
    }
    detoursList.querySelectorAll('.detour-row').forEach(bindRemove);

    addDetourBtn.addEventListener('click', function () {
      const row = detoursList.querySelector('.detour-row').cloneNode(true);
      row.querySelector('input').value = '';
      detoursList.appendChild(row);
      bindRemove(row);
      row.querySelector('input').focus();
    });
  }

  const photoInput = document.getElementById('photos');
  const preview = document.getElementById('photo-preview');
  if (photoInput && preview) {
    photoInput.addEventListener('change', function () {
      preview.innerHTML = '';
      Array.from(photoInput.files || []).forEach(function (file) {
        const url = URL.createObjectURL(file);
        const fig = document.createElement('div');
        fig.className = 'overflow-hidden rounded-xl border border-ink-100';
        fig.innerHTML = '<img src="' + url + '" class="h-28 w-full object-cover" alt="' + file.name + '" />';
        preview.appendChild(fig);
      });
    });
  }
})();
