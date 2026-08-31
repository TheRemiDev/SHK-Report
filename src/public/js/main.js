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

  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (evt) {
      if (!window.confirm(form.dataset.confirm)) evt.preventDefault();
    });
  });

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
