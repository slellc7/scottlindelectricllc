/* Scott Lind Electric — progressive enhancement only.
 *
 * Every page works with this file blocked: the nav is a plain wrapped list of
 * links, and the estimate form is a normal POST that lands on the endpoint's
 * own thank-you page. This script only makes both nicer.
 */
(function () {
  'use strict';

  // Marks that JS is running, so CSS can collapse the nav behind a toggle.
  // Without this class the nav stays visible — never hide navigation behind a
  // control that may never be wired up.
  document.documentElement.classList.add('js');

  /* ── mobile nav ────────────────────────────────────────────────────────── */

  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.getElementById('site-nav');

  if (toggle && nav) {
    toggle.hidden = false;
    toggle.setAttribute('aria-expanded', 'false');

    toggle.addEventListener('click', function () {
      var open = nav.getAttribute('data-open') === 'true';
      nav.setAttribute('data-open', open ? 'false' : 'true');
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    });

    // Close on Escape, and when a link is followed within the same page.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.getAttribute('data-open') === 'true') {
        nav.setAttribute('data-open', 'false');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ── estimate form ─────────────────────────────────────────────────────── */

  var forms = document.querySelectorAll('form[data-estimate-form]');

  Array.prototype.forEach.call(forms, function (form) {
    var status = form.parentNode.querySelector('[data-form-status]');
    var error = form.querySelector('[data-form-error]');
    var submit = form.querySelector('button[type="submit"]');
    var endpoint = form.getAttribute('action');

    // No endpoint wired up yet (see README): leave the form as a plain POST so
    // the failure is visible during setup rather than silently swallowed here.
    if (!endpoint || endpoint.indexOf('REPLACE_ME') !== -1) return;

    form.addEventListener('submit', function (e) {
      // Honeypot: a bot fills every field it finds, a person never sees this one.
      if (form.elements.company && form.elements.company.value) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      if (error) error.hidden = true;

      var label = submit ? submit.textContent : '';
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Sending…';
      }

      fetch(endpoint, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Request failed: ' + res.status);
          form.hidden = true;
          if (status) {
            status.hidden = false;
            status.setAttribute('tabindex', '-1');
            status.focus();
          }
        })
        .catch(function () {
          if (submit) {
            submit.disabled = false;
            submit.textContent = label;
          }
          if (error) {
            error.hidden = false;
          } else {
            form.submit(); // fall back to a real navigation
          }
        });
    });
  });
})();
