/* Marchem Australasia, site interactions (vanilla, ~4 KB) */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Header state on scroll ---------- */
  const header = $('[data-header]');
  if (header) {
    let ticking = false;
    const update = () => { header.classList.toggle('is-scrolled', window.scrollY > 8); ticking = false; };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------- Mobile navigation ---------- */
  const burger = $('[data-burger]');
  const mnav = $('[data-mnav]');
  if (burger && mnav) {
    const open = () => {
      mnav.hidden = false;
      requestAnimationFrame(() => mnav.classList.add('is-open'));
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Close menu');
      document.body.classList.add('nav-open');
    };
    const close = () => {
      mnav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Open menu');
      document.body.classList.remove('nav-open');
      setTimeout(() => { if (!mnav.classList.contains('is-open')) mnav.hidden = true; }, 300);
    };
    burger.addEventListener('click', () => (burger.getAttribute('aria-expanded') === 'true' ? close() : open()));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !mnav.hidden) { close(); burger.focus(); } });
    $$('a', mnav).forEach((a) => a.addEventListener('click', close));
    window.matchMedia('(min-width: 1025px)').addEventListener('change', (e) => { if (e.matches) close(); });
  }

  /* ---------- Reveal on scroll ---------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Animated counters ---------- */
  const counters = $$('[data-count]');
  const format = (n, el) => `${el.dataset.prefix || ''}${Math.round(n).toLocaleString('en-AU')}${el.dataset.suffix || ''}`;
  const run = (el) => {
    const target = parseFloat(el.dataset.count);
    if (reduceMotion) { el.textContent = format(target, el); return; }
    const duration = 1600;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = format(target * (1 - Math.pow(1 - p, 3)), el);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (counters.length && 'IntersectionObserver' in window) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { run(entry.target); co.unobserve(entry.target); } });
    }, { threshold: 0.5 });
    counters.forEach((el) => co.observe(el));
  }

  /* ---------- Footer year ---------- */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Enquiry form ---------- */
  const form = $('#enquiry-form');
  if (form) {
    // Pre-select the product of interest from ?interest=… (e.g. links on product pages).
    const interest = new URLSearchParams(location.search).get('interest');
    const select = form.elements.interest;
    if (interest && select && $$('option', select).some((o) => o.value === interest)) select.value = interest;

    const success = $('#form-success');
    const errorBox = $('.form-error', form);
    const submit = $('button[type="submit"]', form);
    const submitHTML = submit.innerHTML;
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    const messages = {
      name: 'Please enter your name.',
      email: 'Please enter a valid email address.',
      interest: 'Please choose what you are enquiring about.',
      message: 'Please tell us a little about your requirements.',
      consent: 'Please confirm we may contact you about this enquiry.',
    };

    const validateField = (input) => {
      const field = input.closest('.field');
      if (!field) return true;
      let ok = true;
      if (input.type === 'checkbox') ok = !input.required || input.checked;
      else if (input.required && !input.value.trim()) ok = false;
      else if (input.type === 'email' && input.value.trim()) ok = emailRe.test(input.value.trim());
      else if (input.name === 'message' && input.value.trim().length < 10) ok = false;
      field.classList.toggle('is-invalid', !ok);
      input.setAttribute('aria-invalid', String(!ok));
      const err = $('.field__error', field);
      if (err && !ok) err.textContent = messages[input.name] || 'Please check this field.';
      return ok;
    };

    $$('input, select, textarea', form).forEach((input) => {
      const evt = input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'blur';
      input.addEventListener(evt, () => validateField(input));
      input.addEventListener('input', () => { if (input.closest('.field')?.classList.contains('is-invalid')) validateField(input); });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.classList.remove('is-visible');
      const required = $$('[required]', form);
      const invalid = required.filter((input) => !validateField(input));
      if (invalid.length) { invalid[0].focus(); return; }
      if (form.elements.website && form.elements.website.value) return; // honeypot: silently drop bots

      submit.disabled = true;
      submit.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending…';

      // ----------------------------------------------------------------
      // TODO (go-live): set data-endpoint on the <form> to the mail
      // handler (e.g. Formspree / Web3Forms / your own API). Until then
      // the form validates and shows the success state without sending.
      // ----------------------------------------------------------------
      const endpoint = form.dataset.endpoint;
      try {
        if (endpoint) {
          const res = await fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } else {
          console.warn('[Marchem] Enquiry form has no endpoint yet; submission not sent.', Object.fromEntries(new FormData(form)));
          await new Promise((r) => setTimeout(r, 900));
        }
        const first = (form.elements.name.value || '').trim().split(' ')[0];
        $('[data-success-name]', success).textContent = first ? `, ${first}` : '';
        form.hidden = true;
        $('.form-card__intro')?.setAttribute('hidden', '');
        success.classList.add('is-visible');
        success.setAttribute('tabindex', '-1');
        success.focus();
      } catch (err) {
        errorBox.classList.add('is-visible');
      } finally {
        submit.disabled = false;
        submit.innerHTML = submitHTML;
      }
    });

    $('[data-form-reset]')?.addEventListener('click', () => {
      form.reset();
      form.hidden = false;
      $('.form-card__intro')?.removeAttribute('hidden');
      success.classList.remove('is-visible');
      form.elements.name.focus();
    });
  }
})();
