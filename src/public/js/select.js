(function () {
  'use strict';

  var OPEN_CLASS = 'is-open';
  var activeInstance = null;

  function closeActive() {
    if (activeInstance) {
      activeInstance.close();
      activeInstance = null;
    }
  }

  function enhance(select) {
    if (select.dataset.enhanced === 'true') return;
    select.dataset.enhanced = 'true';

    var wrapper = document.createElement('div');
    wrapper.className = 'ui-select';

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'ui-select-trigger';

    var label = document.createElement('span');
    label.className = 'ui-select-label';

    var arrow = document.createElement('span');
    arrow.className = 'ui-select-arrow';
    arrow.innerHTML =
      '<svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>';

    trigger.appendChild(label);
    trigger.appendChild(arrow);

    var panel = document.createElement('div');
    panel.className = 'ui-select-panel';
    panel.setAttribute('role', 'listbox');

    var optionEls = [];
    Array.prototype.forEach.call(select.options, function (opt) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'ui-select-option';
      item.textContent = opt.textContent;
      item.setAttribute('role', 'option');
      item.dataset.value = opt.value;
      item.addEventListener('click', function () {
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        syncLabel();
        instance.close();
        trigger.focus();
      });
      panel.appendChild(item);
      optionEls.push(item);
    });

    select.classList.add('ui-select-native');
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);

    function syncLabel() {
      var opt = select.options[select.selectedIndex];
      label.textContent = opt ? opt.textContent : '';
      optionEls.forEach(function (item) {
        var isSelected = item.dataset.value === select.value;
        item.classList.toggle('is-selected', isSelected);
        item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
    }

    var instance = {
      open: function () {
        closeActive();
        wrapper.classList.add(OPEN_CLASS);
        trigger.setAttribute('aria-expanded', 'true');
        activeInstance = instance;
        var current = panel.querySelector('.is-selected');
        if (current) current.scrollIntoView({ block: 'nearest' });
      },
      close: function () {
        wrapper.classList.remove(OPEN_CLASS);
        trigger.setAttribute('aria-expanded', 'false');
      },
    };

    trigger.addEventListener('click', function (evt) {
      evt.stopPropagation();
      if (wrapper.classList.contains(OPEN_CLASS)) {
        instance.close();
        activeInstance = null;
      } else {
        instance.open();
      }
    });

    trigger.addEventListener('keydown', function (evt) {
      var idx = optionEls.findIndex(function (item) {
        return item.dataset.value === select.value;
      });
      if (evt.key === 'ArrowDown') {
        evt.preventDefault();
        if (!wrapper.classList.contains(OPEN_CLASS)) instance.open();
        var next = optionEls[Math.min(optionEls.length - 1, idx + 1)];
        if (next) next.click();
      } else if (evt.key === 'ArrowUp') {
        evt.preventDefault();
        if (!wrapper.classList.contains(OPEN_CLASS)) instance.open();
        var prev = optionEls[Math.max(0, idx - 1)];
        if (prev) prev.click();
      } else if (evt.key === 'Escape') {
        instance.close();
      } else if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        if (wrapper.classList.contains(OPEN_CLASS)) instance.close();
        else instance.open();
      }
    });

    select.addEventListener('change', syncLabel);
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    syncLabel();
  }

  document.addEventListener('click', closeActive);

  function init() {
    document.querySelectorAll('select.field-select').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.reinitSelects = init;
})();
