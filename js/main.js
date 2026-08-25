/* ============================================================
   InstaBuilt — interactions: popup modals, gallery, nav, reveals
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Navbar scroll state ---------- */
  const navbar = document.querySelector('.navbar');
  const onScrollNav = () => navbar.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScrollNav);
  onScrollNav();

  /* ---------- Mobile menu ---------- */
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      navLinks.classList.toggle('open');
    });
  }
  // mobile dropdown toggles
  document.querySelectorAll('.dropdown > a').forEach((link) => {
    link.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        link.parentElement.classList.toggle('open');
      }
    });
  });

  /* ---------- Modal / popup system ---------- */
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');

  function setGallery(images) {
    const all = [images[0], ...images.slice(1)];
    document.getElementById('modal-main-img').src = images[0];
    document.getElementById('modal-main-img').alt = document.getElementById('modal-title').textContent;
    const thumbs = document.getElementById('modal-thumbs');
    thumbs.innerHTML = '';
    all.forEach((src, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      if (i === 0) btn.classList.add('active');
      const img = document.createElement('img');
      img.src = src;
      img.alt = document.getElementById('modal-title').textContent + ' foto ' + (i + 1);
      btn.appendChild(img);
      btn.addEventListener('click', () => {
        document.getElementById('modal-main-img').src = src;
        thumbs.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
      thumbs.appendChild(btn);
    });
  }

  function openModal(house) {
    if (!overlay || !house) return;
    // model tabs
    const modelsWrap = document.getElementById('modal-models');
    modelsWrap.innerHTML = '';
    const modelImages = [house.main, ...(house.gallery || [])];
    if (house.models && house.models.length) {
      const hint = document.createElement('span');
      hint.className = 'modal-models-hint';
      hint.textContent = '👆 Prek një model për ta parë brenda e jashtë:';
      modelsWrap.appendChild(hint);
      const allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = 'modal-model-btn active';
      allBtn.textContent = '🏠 Të gjitha pamjet';
      allBtn.addEventListener('click', () => {
        setGallery(modelImages);
        modelsWrap.querySelectorAll('.modal-model-btn').forEach((b) => b.classList.remove('active'));
        allBtn.classList.add('active');
      });
      modelsWrap.appendChild(allBtn);
      house.models.forEach((m) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'modal-model-btn';
        btn.textContent = m.name + ' · ' + m.size;
        btn.addEventListener('click', () => {
          setGallery(m.images);
          modelsWrap.querySelectorAll('.modal-model-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        });
        modelsWrap.appendChild(btn);
      });
    }
    // main gallery image
    setGallery(modelImages);

    // badge + title + lead
    document.getElementById('modal-tag').textContent = house.tag || 'Solution';
    document.getElementById('modal-title').textContent = house.title;
    document.getElementById('modal-lead').textContent = house.lead || '';

    // specs
    const specsWrap = document.getElementById('modal-specs');
    specsWrap.innerHTML = '';
    (house.specs || []).forEach((s) => {
      const div = document.createElement('div');
      div.className = 'spec';
      const b = document.createElement('b');
      b.textContent = s.k;
      const span = document.createElement('span');
      span.textContent = s.v;
      div.appendChild(b);
      div.appendChild(span);
      specsWrap.appendChild(div);
    });

    // description
    document.getElementById('modal-desc').innerHTML = house.desc || '';

    // pdf download
    const pdfWrap = document.getElementById('modal-pdf');
    pdfWrap.innerHTML = '';
    if (house.pdf) {
      const a = document.createElement('a');
      a.href = house.pdf;
      a.download = '';
      a.className = 'btn btn-primary';
      a.textContent = '📥 Download Catalog (PDF)';
      pdfWrap.appendChild(a);
    }

    // video
    const vidWrap = document.getElementById('modal-video');
    if (house.video) {
      vidWrap.style.display = 'block';
      vidWrap.innerHTML = '';
      const video = document.createElement('video');
      video.controls = true;
      video.preload = 'metadata';
      video.poster = house.main;
      const src = document.createElement('source');
      src.src = house.video;
      src.type = 'video/mp4';
      video.appendChild(src);
      vidWrap.appendChild(video);
    } else {
      vidWrap.style.display = 'none';
      vidWrap.innerHTML = '';
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    modal.scrollTop = 0;
  }

  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    const vidWrap = document.getElementById('modal-video');
    if (vidWrap) vidWrap.innerHTML = ''; // stop video playback
  }

  // close button
  const closeBtn = document.querySelector('.modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  // click main image -> full-size zoom (lightbox)
  const mainImg = document.getElementById('modal-main-img');
  if (mainImg) mainImg.addEventListener('click', () => {
    if (mainImg.src) {
      lightboxImg.src = mainImg.src;
      lightboxImg.alt = mainImg.alt;
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  });

  // click on backdrop
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // wire up data-house buttons
  document.querySelectorAll('[data-house]').forEach((el) => {
    el.addEventListener('click', () => {
      const h = window.HOUSES[el.dataset.house];
      if (h) openModal(h);
    });
  });

  /* ---------- Lightbox for single images (gallery/seasons) ---------- */
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  document.querySelectorAll('[data-lightbox]').forEach((el) => {
    el.addEventListener('click', () => {
      lightboxImg.src = el.dataset.lightbox;
      lightboxImg.alt = el.querySelector('img')?.alt || 'Foto';
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target === lightboxImg) {
        lightbox.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  /* ---------- Accordions (why-buy advantages + FAQ) ---------- */
  function bindAccordion(rootSel, itemSel, headSel, bodySel, single) {
    document.querySelectorAll(rootSel + ' ' + itemSel).forEach((item) => {
      const head = item.matches(headSel) ? item : item.querySelector(headSel);
      const body = item.querySelector(bodySel);
      if (!head || !body) return;
      const open = () => {
        if (single) {
          document.querySelectorAll(rootSel + ' ' + itemSel + '.open').forEach((other) => {
            if (other !== item) {
              other.classList.remove('open');
              other.querySelector(bodySel).style.maxHeight = '0px';
            }
          });
        }
        const isOpen = item.classList.toggle('open');
        body.style.maxHeight = isOpen ? body.scrollHeight + 'px' : '0px';
      };
      head.addEventListener('click', open);
      head.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }
  bindAccordion('#why', '.why-acc', '.why-acc-head', '.why-acc-body', true);
  bindAccordion('.faq-wrap', '.faq-item', '.faq-q', '.faq-a', true);
  bindAccordion('#construction', '.offer-acc', '.offer-acc-head', '.offer-acc-body', true);

  /* ---------- Building elements filter tabs ---------- */
  const elemTabs = document.getElementById('elem-tabs');
  if (elemTabs) {
    elemTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.elem-tab');
      if (!btn) return;
      elemTabs.querySelectorAll('.elem-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      document.querySelectorAll('#walls-grid .wall-card').forEach((card) => {
        const show = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('hidden', !show);
      });
    });
  }

  /* ---------- Pillars (Speed / Sustainability / Affordability) ---------- */
  bindAccordion('.pillars-grid', '.pillar', '.pillar', '.pillar-body', true);

  /* ---------- Our Process steps ---------- */
  bindAccordion('.process-grid', '.process-step', '.process-step', '.process-more', true);

  /* ---------- Advantages of Off-site Construction ---------- */
  bindAccordion('.adv-grid', '.adv-item', '.adv-item', '.adv-more', true);

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('visible');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  /* ---------- Smooth anchor offset ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length > 1) {
        const target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          const top = target.getBoundingClientRect().top + window.scrollY - 84;
          window.scrollTo({ top, behavior: 'smooth' });
          navLinks.classList.remove('open');
          hamburger.classList.remove('open');
        }
      }
    });
  });
})();
