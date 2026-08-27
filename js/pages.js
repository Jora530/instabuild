/* ============================================================
   InstaBuilt — sub-page interactions: nav scroll, mobile menu,
   reveal animations, FAQ accordion
   ============================================================ */
(function () {
  'use strict';

  /* Navbar scroll state */
  var navbar = document.querySelector('.navbar');
  if (navbar) {
    var onScroll = function () { navbar.classList.toggle('scrolled', window.scrollY > 10); };
    window.addEventListener('scroll', onScroll);
    onScroll();
  }

  /* Mobile menu */
  var hamburger = document.querySelector('.hamburger');
  var navLinks = document.querySelector('.nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', function () {
      hamburger.classList.toggle('open');
      navLinks.classList.toggle('open');
    });
  }

  /* Mobile dropdown toggle */
  document.querySelectorAll('.dropdown > a').forEach(function (link) {
    link.addEventListener('click', function (e) {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        link.parentElement.classList.toggle('open');
      }
    });
  });

  /* Reveal on scroll */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  }

  /* FAQ accordion (single-open) */
  function bindAccordion(rootSel) {
    document.querySelectorAll(rootSel + ' .faq-item').forEach(function (item) {
      var head = item.querySelector('.faq-q');
      var body = item.querySelector('.faq-a');
      if (!head || !body) return;
      head.addEventListener('click', function () {
        var isOpen = item.classList.toggle('open');
        body.style.maxHeight = isOpen ? body.scrollHeight + 'px' : '0px';
        document.querySelectorAll(rootSel + ' .faq-item.open').forEach(function (other) {
          if (other !== item) {
            other.classList.remove('open');
            var ob = other.querySelector('.faq-a');
            if (ob) ob.style.maxHeight = '0px';
          }
        });
      });
      head.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); head.click(); }
      });
    });
  }
  bindAccordion('.faq-wrap');

  /* Clickable explanation cards (innovation center) */
  document.querySelectorAll('.space-card, .hub-item').forEach(function (card) {
    card.addEventListener('click', function () {
      var more = card.querySelector('.card-more');
      if (!more) return;
      var open = card.classList.toggle('open');
      more.style.maxHeight = open ? more.scrollHeight + 'px' : '0px';
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });
})();
