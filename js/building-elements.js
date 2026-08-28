/* ============================================================
   InstaBuilt — Building Elements (layer-by-layer systems)
   Data + rendering + "Check Details" modal (product composition)
   ============================================================ */
(function () {
  'use strict';

  var CATEGORY = {
    'exterior-walls':   { filter: 'exterior',   label: 'Exterior Walls',   folder: 'exterior-walls' },
    'separating-walls': { filter: 'separating', label: 'Separating Walls', folder: 'separating-walls' },
    'roofs':            { filter: 'roofs',      label: 'Roofs',            folder: 'roofs' },
    'floors':           { filter: 'floors',     label: 'Floors',           folder: 'floors' }
  };

  var ELEMENTS = [{"t":"External Wall 68","c":"exterior-walls","i":"external_wall_68_construction_layers.jpg","l":["Final Plaster - 2mm","Plaster (with reinforcement) - 3mm","Wood Insulation Board - 80mm","Oriented Strand Board","Stud - 60/240mm Rail - 80/240mm","Wood Fibre Insulation - 240mm","Vapour Barrier - 0.2mm","Oriented Strand Board - 15mm","Gypsum Fireboard - 12.5mm"]},{"t":"External Wall 67","c":"exterior-walls","i":"external_wall_67_construction_layers.jpg","l":["Final Plaster - 2mm","Plaster (with reinforcement) - 3mm","Wood Insulation Board - 80mm","Oriented Strand Board","Stud - 60/240mm Rail - 80/240mm","Wood Fibre Insulation - 240mm","Vapour Barrier - 0.2mm","Oriented Strand Board - 15mm","Gypsum Fireboard - 12.5mm"]},{"t":"External Wall 66","c":"exterior-walls","i":"external-wall-66-plaster-wood-insulation-orient-strand-board-wood-fibre.jpg","l":["Final Plaster - 2mm","Plaster (with reinforcement) - 3mm","Wood Insulation Board - 80mm","Oriented Strand Board","Stud - 60/240mm Rail - 80/240mm","Wood Fibre Insulation - 240mm","Vapour Barrier - 0.2mm","Oriented Strand Board - 15mm"]},{"t":"External Wall 65","c":"exterior-walls","i":"external-wall-65-plaster-insulation-wood-orient-strand-board-mineral-stone-wool.jpg","l":["Final Plaster - 2mm","Plaster (with reinforcement) - 3mm","Wood Insulation Board - 80mm","Oriented Strand Board","Stud - 60/240mm Rail - 80/240mm","Mineral Stone Wool - 240mm","Vapour Barrier - 0.2mm","Orinted Strand Board - 15mm"]},{"t":"External Wall 64","c":"exterior-walls","i":"external-wall-63-timber-facade-mineral-stone-wool-clt-gypsum-fireboard-1.jpg","l":["Timber Facade Board 100-160/20mm","Timber Batten/Ventilation Space - 60/40mm","Vapour permeable membrane - 0.6mm","Timber Batten - 60/80mm","Mineral Stone Wool - 80mm","Timber Counter Batten - 60/80mm","Mineral Stone Wool - 80mm","Cross Laminated Timber - 80mm","Gypsum Fireboard - 12.5mm"]},{"t":"External Wall 63","c":"exterior-walls","i":"external-wall-63-timber-facade-mineral-stone-wool-clt-gypsum-fireboard.jpg","l":["Timber Facade Board 100-160/20mm","Timber Batten/Ventilation Space - 100/40mm","Vapour permeable membrane - 0.6mm","Mineral Stone Wool - 160mm","Adhesive - 1mm","Cross Laminated Timber - 80mm","Gypsum Fireboard 12.5mm"]},{"t":"External Wall 62","c":"exterior-walls","i":"external-wall-62-plaster-eps-clt-timber-batten-double-plasterboard.jpg","l":["Final Plaster - 2mm","Plaster (with reinforcement) - 3mm","EPS - 100mm","Adhesive - 1mm","Cross Laminated Timber - 80mm","Timber Batten - 60/50","Gypsum Plasterboard - 12.5mm","Gypsum Plasterboard - 12.5mm"]},{"t":"External Wall 61","c":"exterior-walls","i":"external-wall-61-plaster-stone-wool-clt-timber-batten-double-plasterboard.jpg","l":["Final Plaster - 2mm","Plaster (with reinforcement) - 3mm","Mineral Stone Wool - 100mm","Adhesive - 1mm","Cross Laminated Timber - 80mm","Timber Batten - 60/50","Gypsum Plasterboard - 12.5mm","Gypsum Plasterboard - 12.5mm"]},{"t":"External Wall 60","c":"exterior-walls","i":"external-wall-60-plaster-eps-clt-timber-batten-double-fireboard.jpg","l":["Final Plaster - 2mm","Plaster (with reinforcement) - 3mm","EPS - 100mm","Adhesive - 1mm","Cross Laminated Timber - 80mm","Timber Batten - 60/50","Gypsum Fireboard - 12.5mm","Gypsum Fireboard - 12.5mm"]},{"t":"External Wall 59","c":"exterior-walls","i":"external-wall-59-plaster-stone-wool-clt-timber-batten-double-fireboard.jpg","l":["Final Plaster - 2mm","Plaster (with reinforcement) - 3mm","Mineral Stone Wool - 100mm","Adhesive - 1mm","Cross Laminated Timber - 80mm","Timber Batten - 60/50","Gypsum Fireboard - 12.5mm","Gypsum Fireboard - 12.5mm"]},{"t":"External Wall 58","c":"exterior-walls","i":"external-wall-58-plaster-eps-clt-timber-batten.jpg","l":["Final Plaster - 2mm","Plaster (with reinforcement) - 3mm","EPS - 100mm","Adhesive - 1mm","Cross Laminated Timber - 80mm","Timber Batten - 60/50","Gypsum Fireboard - 12.5mm"]},{"t":"External Wall 57","c":"exterior-walls","i":"external-wall-57-plaster-stone-wool-clt-timber-batten.jpg","l":["Final Plaster - 2mm","Plaster (with reinforcement) - 3mm","Mineral Stone Wool - 100mm","Adhesive - 1mm","Cross Laminated Timber - 80mm","Timber Batten - 60/50","Gypsum Fireboard - 12.5mm"]},{"t":"Separating Wall 24","c":"separating-walls","i":"separating-wall-24-plasterboard-osb-timber-frame-insulation.jpg","l":["Gypsum Plasterboard - 12.5mm","Oriented Strand Board - 15mm","Timber frame Stud - 60/160 Rail - 80/160","Mineral Stone Wool - 100mm","Timber frame Stud - 60/160 Rail - 80/160","Oriented Strand Board - 15mm","Gypsum Plasterboard - 12.5mm"]},{"t":"Separating Wall 23","c":"separating-walls","i":"separating-wall-23-gypsum-fireboard-osb-timber-frame-insulation.jpg","l":["Gypsum Fireboard - 12.5mm","Oriented Strand Board - 15mm","Timber Frame Stud - 60/100 Rail - 60/100","Mineral Stone Wool - 100mm","Timber Frame Stud - 60/100 Rail - 60/100","Oriented Strand Board - 15mm","Gypsum Fireboard"]},{"t":"Separating Wall 22","c":"separating-walls","i":"separating-wall-22-gypsum-fireboard-clt-timber-counter-batten.jpg","l":["Gypsum Fireboard - 12.5mm","Cross Laminated Timber - 80mm","Timber Counter Batten - 60/50","Gypsum Fireboard - 12.5mm"]},{"t":"Separating Wall 21","c":"separating-walls","i":"separating-wall-21-plasterboard-clt-80mm.jpg","l":["Gypsum Plasterboard - 12.5mm","Cross Laminated Timber - 80mm","Gypsum Plasterboard - 12.5mm"]},{"t":"Separating Wall 20","c":"separating-walls","i":"separating-wall-20-gypsum-fireboard-clt-80mm.jpg","l":["Gypsum Fireboard - 12.5mm","Cross Laminated Timber - 80mm","Gypsum Fireboard - 12.5mm"]},{"t":"Separating Wall 19","c":"separating-walls","i":"separating-wall-19-cross-laminated-timber-80mm.jpg","l":["Cross Laminated Timber - 80mm"]},{"t":"Separating Wall 18","c":"separating-walls","i":"separating-wall-18-plasterboard-osb-timber-frame-insulation.jpg","l":["Gypsum Plasterboard - 12.5mm","Oriented Strand Board - 15mm","Stud - 60/160mm Rail - 80/160mm","Wood Fibre Insulation - 160mm","Oriented Strand Board - 15mm","Gypsum Plasterboard - 12.5mm"]},{"t":"Separating Wall 17","c":"separating-walls","i":"separating-wall-17-plasterboard-osb-stud-insulation.jpg","l":["Gypsum Plasterboard - 12.5mm","Oriented Strand Board - 15mm","Stud - 60/100mm Rail - 80/100mm","Wood Fibre Insulation - 100mm","Oriented Strand Board - 15mm","Gypsum Plasterboard - 12.5mm"]},{"t":"Separating Wall 16","c":"separating-walls","i":"separating-wall-16-plasterboard-timber-frame-insulation.jpg","l":["Gypsum Plasterboard - 12.5mm","Stud - 60/160mm Rail - 80/160mm","Wood Fibre Insulation - 160mm","Gypsum Plasterboard - 12.5mm"]},{"t":"Separating Wall 15","c":"separating-walls","i":"separating-wall-15-plasterboard-stud-insulation.jpg","l":["Gypsum Plasterboard - 12.5mm","Stud - 60/100mm Rail - 80/100mm","Wood Fibre Insulation - 100mm","Gypsum Plasterboard - 12.5mm"]},{"t":"Separating Wall 14","c":"separating-walls","i":"separating-wall-14-gypsum-fireboard-timber-frame-insulation.jpg","l":["Gypsum Fireboard - 12.5mm","Timber frame Stud - 60/160 Rail - 80/160","Wood Fibre Insulation-fully installed - 160 mm","Gypsum Fireboard - 12.5mm"]},{"t":"Separating Wall 13","c":"separating-walls","i":"separating-wall-13-gypsum-fireboard-stud-insulation.jpg","l":["Gypsum Fireboard - 12.5mm","Stud - 60/100mm Rail - 80/100mm","Wood Fibre Insulation - 100mm","Gypsum Fireboard - 12.5mm"]},{"t":"Roof 21","c":"roofs","i":"roof-21-materials-osb-timber-fibre-insulation-fireboard.jpg","l":["Roofing Membrane - 1.5mm","Oriented Strand Board - 15mm","Sloped Timber Batten - 60/60-120","Vapour permeable membrane - 0.6mm","Structural Timber - 60/160 (200) (240)mm","Wood Fibre Insulation - 160 (200) (240) mm","Structural Timber - 60/200mm","Wood Fibre Insulation - 200mm","Vapour Barrier - 0.2mm","Oriented Strand Board - 15mm","Gypsum Fireboard - 12.5mm"]},{"t":"Roof 20","c":"roofs","i":"roof-20-materials-osb-timber-fibre-stone-plasterboard.jpg","l":["Roofing Membrane - 1.5mm","Oriented Strand Board - 15mm","Sloped Timber Batten - 60/60-120mm","Vapour permeable membrane - 0.6mm","Oriented Strand Board - 15mm","Structural Timber - 60/200mm","Wood Fibre Insulation - 200mm","Structural Timber - 60/200mm","Wood Fibre Insulation - 200mm","Vapour Barrier - 0.2mm","Oriented Strand Board - 15mm","Gypsum Plasterboard - 12.5mm"]},{"t":"Roof 19","c":"roofs","i":"roof-19-materials-osb-timber-stone-wool-plasterboard.jpg","l":["Roofing Membrane - 1.5mm","Oriented Strand Board - 15mm","Sloped Timber Batten - 60/60-120mm","Vapour permeable membrane - 0.6mm","Structural Timber - 60/200mm","Mineral Stone Wool - 200mm","Structural Timber - 60/200mm","Mineral Stone Wool - 200mm","Vapour Barrier - 0.2mm","Oriented Strand Board - 15mm","Gypsum Plasterboard - 12.5mm"]},{"t":"Roof 18","c":"roofs","i":"roof-18-materials-osb-timber-stone-wool-plasterboard.jpg","l":["Roofing Membrane - 1.5mm","Oriented Strand Board - 15mm","Sloped Timber Batten - 60/60-120mm","Vapour permeable membrane - 0.6mm","Oriented Strand Board - 15mm","Structural Timber - 60/200mm","Mineral Stone Wool - 200mm","Structural Timber - 60/200mm","Mineral Stone Wool - 200mm","Vapour Barrier - 0.2mm","Oriented Strand Board - 15mm","Gypsum Plasterboard - 12.5mm"]},{"t":"Roof 17","c":"roofs","i":"roof-17-materials-membrane-osb-timber-insulation-battens.jpg","l":["Roofing Membrane - 1.5mm","Oriented Strand Board - 15mm","Sloped Timber Battens - 60/60-120mm","Vapour Permeable Membrane - 0.6mm","Wood Insulation Board -80mm","Timber Battens - 60/160mm","Wood Fibre Insulation - 160mm","Bitumen Waterproof Membrane - 3mm","Cross Laminated Timber - 140mm"]},{"t":"Roof 16","c":"roofs","i":"roof-16-materials-membrane-wood-fibre-timber-batten-plasterboard.jpg","l":["Roofing Membrane - 1.5mm","Wood Fibre Insulation - 140mm","Wood Fibre Insulation - 140mm","Bitument Waterproof Membrane - 3mm","Cross Laminated Timber - 140mm","Timber Batten - 80/32mm","Gypsum Plasterboard - 12.5mm"]},{"t":"Roof 15","c":"roofs","i":"roof-15-materials-membrane-stone-wool-timber-batten-plasterboard.jpg","l":["Roofing Membrane - 1.5mm","Mineral Stone Wool - 140mm","Mineral Stone Wool - 140mm","Bitument Waterproof Membrane - 3mm","Cross Laminated Timber - 140mm","Timber Batten - 80/32mm","Gypsum Plasterboard - 12.5mm"]},{"t":"Roof 14","c":"roofs","i":"roof-14-materials-membrane-wood-fibre-cross-laminated-timber.jpg","l":["Roofing Membrane - 1.5mm","Wood Fibre Insulation - 140mm","Wood Fibre Insulation - 140mm","Bitument Waterproof Membrane - 3mm","Cross Laminated Timber - 140mm"]},{"t":"Roof 13","c":"roofs","i":"roof-13-materials-membrane-stone-wool-cross-laminated-timber.jpg","l":["Roofing Membrane - 1.5mm","Mineral Stone Wool - 140mm","Mineral Stone Wool - 140mm","Bitument Waterproof Membrane - 3mm","Cross Laminated Timber - 140mm"]},{"t":"Roof 12","c":"roofs","i":"roof-12-materials-timber-batten-insulation-ventilation.jpg","l":["Timber Batten 60/40","Timber Batten/Ventilation Space 100/50","Vapour permeable membrane - 0.6mm","Wood Fibre Isolation - 140mm","Wood Fibre Isolation - 140mm","Vapour Barrier - 0.2mm","Solid Timber Cladding - 25mm","Rafter - 140/200 mm"]},{"t":"Roof 11","c":"roofs","i":"roof-11-materials-membrane-timber-insulation-vapour-barrier.jpg","l":["Roofing Membrane - 1.5mm","Oriented Strand Board - 15mm","Sloped Timber Batten - 60/60-120","Vapour permeable membrane - 0.6mm","Wood Insulation Board - 80mm","Rafter - 60/240 (200)mm","Wood Fibre Insulation - 240 (200)mm","Vapour Barrier - 0.2mm","Timber Batten - 60/50","Mineral Stone Wool - 50mm","Gypsum Fireboard - 12.5mm"]},{"t":"Roof 10","c":"roofs","i":"roof-10-materials-timber-batten-insulation-vapour-barrier.jpg","l":["Timber Batten 60/40","Timber Batten/Ventilation Space 80/50","Vapour permeable membrane - 0.6mm","Wood Insulation Board - 80mm","Rafter - 60/240mm","Wood Fibre Insulation - 240mm","Vapour Barrier - 0.2mm","Timber Batten - 60/50","Mineral Stone Wool - 50mm","Gypsum Fireboard - 12.5mm"]},{"t":"Floor 9","c":"floors","i":"floor-9-materials-cross-laminated-timber-battens-gypsum-plasterboard.png","l":["Cross Laminated Timber - 14mm","Timber Battens 80/32 (distance<300mm)","Gypsum Fireboard - 12.5mm","Gypsum Plasterboard - 12.5mm"]},{"t":"Floor 8","c":"floors","i":"floor-8-materials-cross-laminated-timber-battens-gypsum.png","l":["Cross Laminated Timber - 14mm","Timber Battens 80/32 (distance<300mm)","Gypsum Fireboard - 12.5mm"]},{"t":"Floor 7","c":"floors","i":"floor-7-materials-cross-laminated-timber-gypsum.png","l":["Cross Laminated Timber - 14mm","Gypsum Fireboard - 12.5mm"]},{"t":"Floor 5","c":"floors","i":"floor-5-materials-osb-wood-fibre-timber-gypsum-barrier.png","l":["Oriented Strand Board - 22mm","Wood Fibre Insulation - 100mm","Solid / Glue Laminated Joist - 80/200mm","Vapour Barrier - 0.2mm","Spaced Timber Board - 80/22","Gypsum Fireboard - 12.5mm","Gypsum Fireboard - 12.5mm"]},{"t":"Floor 5-5","c":"floors","i":"floor-5-5-materials-osb-wood-fibre-timber-gypsum-barrier.png","l":["Oriented Strand Board - 22mm","Wood Fibre Insulation - 240mm","Solid/Glue Laminated Joist - 80/240","Vapour Barrier - 0.2mm","Spaced Timber Board - 80/22mm","Gypsum Fireboard - 12.5mm","Gypsum Fireboard - 12.5mm"]},{"t":"Floor 4","c":"floors","i":"floor-4-materials-osb-mineral-wool-timber-gypsum-barrier.png","l":["Oriented Strand Board - 22mm","Mineral Stone Wool - 100mm","Solid / Glue Laminated Joist - 80/200mm","Vapour Barrier - 0.2mm","Spaced Timber Board - 80/22","Gypsum Fireboard - 12.5mm","Gypsum Fireboard - 12.5mm"]},{"t":"Floor 4-4","c":"floors","i":"floor-4-4-materials-osb-mineral-wool-timber-gypsum-barrier.png","l":["Oriented Strand Board - 22mm","Mineral Stone Wool - 240mm","Solid/Glue Laminated Joist - 80/240","Vapour Barrier - 0.2mm","Spaced Timber Board - 80/22mm","Gypsum Fireboard - 12.5mm","Gypsum Fireboard - 12.5mm"]},{"t":"Floor 3","c":"floors","i":"floor-3-materials-osb-mineral-wool-gypsum-joist.png","l":["Oriented Strand Board - 22mm","Mineral Stone Wool - 100mm","Solid / Glue Laminated Joist - 80/200mm","Gypsum Fireboard - 12.5mm","Gypsum Fireboard - 12.5mm"]},{"t":"Floor 3-3","c":"floors","i":"floor-3-3-materials-osb-mineral-wool-gypsum-joist.png","l":["Oriented Strand Board - 22mm","Mineral Stone Wool - 200mm","Solid / Glue Laminated Joist - 80/200mm","Gypsum Fireboard - 12.5mm","Gypsum Fireboard - 12.5mm"]},{"t":"Floor 2","c":"floors","i":"floor-2-materials-osb-wood-fiber-insulation-joist.png","l":["Oriented Strand Board - 22mm","Wood Fibre Insulation - 100mm","Solid / Glue Laminated Joist - 80/200mm","Oriented Strand Board - 12mm"]},{"t":"Floor 2-2","c":"floors","i":"floor-2-2-materials-osb-mineral-wool-gypsum-joist.jpg.png","l":["Oriented Strand Board - 22mm","Mineral Stone Wool - 240mm","Solid/Glue Laminated Joist - 80/240","Oriented Strand Board - 12mm"]},{"t":"Floor 1","c":"floors","i":"floor-materials-construction-osb-mineral-wool-gypsum-joist.png","l":["Oriented Strand Board - 22mm","Mineral Stone Wool - 100 (200) (240)","Solid/Glue Laminated Joist - 80/200 (240)","Gypsum Fireboard - 12.5mm"]},{"t":"Floor 1-1","c":"floors","i":"floor-materials-construction-osb-mineral-wool-gypsum.png","l":["Oriented Strand Board - 22mm","Mineral Stone Wool - 200mm","Solid / Glue Laminated Joist - 80/200mm","Gypsum Fireboard - 12.5mm"]}];

  var grid, modal, modalImg, modalCat, modalTitle, layersBox;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function imgPath(el) {
    return 'images/construction-system/' + CATEGORY[el.c].folder + '/' + el.i;
  }

  function buildGrid() {
    grid = document.getElementById('walls-grid');
    if (!grid) return;
    var h = '';
    ELEMENTS.forEach(function (el, i) {
      var cat = CATEGORY[el.c];
      h += '<figure class="wall-card be-card" data-category="' + cat.filter + '" data-idx="' + i + '" tabindex="0" role="button" aria-label="' + esc(el.t) + ' — check details" style="animation-delay:' + (i % 10) * 45 + 'ms">'
         +   '<img src="' + imgPath(el) + '" alt="' + esc(el.t) + ' construction layers" loading="lazy">'
         +   '<figcaption>' + esc(el.t) + '<span class="be-hint">View composition →</span></figcaption>'
         + '</figure>';
    });
    grid.innerHTML = h;
  }

  function openModal(i) {
    var el = ELEMENTS[i];
    if (!el) return;
    var cat = CATEGORY[el.c];
    modalImg.src = imgPath(el);
    modalImg.alt = el.t + ' construction layers';
    modalCat.textContent = cat.label;
    modalTitle.textContent = el.t;
    var html = '';
    el.l.forEach(function (layer, n) {
      html += '<li><span class="be-num">' + (n + 1) + '</span><span class="be-layer">' + esc(layer) + '</span></li>';
    });
    layersBox.innerHTML = html;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function initModal() {
    modal = document.getElementById('be-modal');
    if (!modal) return;
    modalImg = document.getElementById('be-modal-img');
    modalCat = document.getElementById('be-modal-cat');
    modalTitle = document.getElementById('be-modal-title');
    layersBox = document.getElementById('be-layers');

    var close = document.getElementById('be-modal-close');
    if (close) close.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

    // Zoom: click the image -> existing lightbox
    if (modalImg) modalImg.addEventListener('click', function () {
      var lb = document.getElementById('lightbox');
      var lbImg = document.getElementById('lightbox-img');
      if (lb && lbImg && modalImg.src) {
        lbImg.src = modalImg.src;
        lbImg.alt = modalImg.alt;
        lb.classList.add('open');
      }
    });

    // When the lightbox closes, keep the scroll lock if the modal is still open
    var lb = document.getElementById('lightbox');
    if (lb) lb.addEventListener('click', function () {
      setTimeout(function () {
        if (!lb.classList.contains('open') && modal.classList.contains('open')) {
          document.body.style.overflow = 'hidden';
        }
      }, 0);
    });
  }

  function initEvents() {
    if (!grid) return;
    grid.addEventListener('click', function (e) {
      var card = e.target.closest('.be-card');
      if (!card) return;
      openModal(parseInt(card.getAttribute('data-idx'), 10));
    });
    grid.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        var card = e.target.closest('.be-card');
        if (card) { e.preventDefault(); openModal(parseInt(card.getAttribute('data-idx'), 10)); }
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  function boot() { buildGrid(); initModal(); initEvents(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
