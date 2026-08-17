// PAPORI 장바구니 공용 스크립트 (localStorage 기반, 정적 사이트 전용— 서버 없이 브라우저에 저장)
// 모든 페이지 </body> 직전에 <script src="cart.js"></script>로 로드됨.
// - 상품 상세페이지: .action-row .btn-outline(장바구니)/.btn-primary(바로구매) 버튼을 실제 담기 동작에 연결
// - 헤더 .cart-badge: 담긴 수량 표시
// - cart.html: 실제 담긴 상품으로 테이블 렌더링
// - checkout.html: PaporiCart.getCart()를 통해 실제 장바구니 데이터 사용
(function () {
  var CART_KEY = 'papori_cart';
  var QUOTE_DRAFT_KEY = 'papori_quote_draft';

  function getQuoteDraft() {
    try {
      var raw = JSON.parse(localStorage.getItem(QUOTE_DRAFT_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  }
  function addToQuoteDraft(item, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    var draft = getQuoteDraft();
    var existing = null;
    for (var i = 0; i < draft.length; i++) { if (draft[i].id === item.id) { existing = draft[i]; break; } }
    if (existing) existing.qty = (parseInt(existing.qty, 10) || 0) + qty;
    else draft.push({ id: item.id, name: item.name, model: item.model || '', qty: qty });
    localStorage.setItem(QUOTE_DRAFT_KEY, JSON.stringify(draft));
  }
  function clearQuoteDraft() { localStorage.removeItem(QUOTE_DRAFT_KEY); }

  function getCart() {
    try {
      var raw = JSON.parse(localStorage.getItem(CART_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  }
  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateBadge();
  }
  function cartCount() {
    return getCart().reduce(function (n, i) { return n + (parseInt(i.qty, 10) || 0); }, 0);
  }
  function updateBadge() {
    var n = cartCount();
    document.querySelectorAll('.cart-badge').forEach(function (el) {
      el.textContent = n > 0 ? (n > 99 ? '99+' : String(n)) : '';
      el.style.display = n > 0 ? 'flex' : 'none';
    });
  }

  function showToast(msg) {
    var toast = document.getElementById('papori-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'papori-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._paporiTimer);
    toast._paporiTimer = setTimeout(function () { toast.classList.remove('show'); }, 1800);
  }

  function addToCart(item, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    var cart = getCart();
    var existing = null;
    for (var i = 0; i < cart.length; i++) { if (cart[i].id === item.id) { existing = cart[i]; break; } }
    if (existing) existing.qty = (parseInt(existing.qty, 10) || 0) + qty;
    else {
      var copy = {};
      for (var k in item) copy[k] = item[k];
      copy.qty = qty;
      cart.push(copy);
    }
    saveCart(cart);
    return cart;
  }
  function removeFromCart(id) {
    saveCart(getCart().filter(function (i) { return i.id !== id; }));
  }
  function setQty(id, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    var cart = getCart();
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) { cart[i].qty = qty; break; }
    }
    saveCart(cart);
  }
  function clearCart() { saveCart([]); }

  function parsePrice(text) {
    if (!text) return NaN;
    var digits = String(text).replace(/[^0-9]/g, '');
    return digits ? parseInt(digits, 10) : NaN;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 상품 상세페이지 DOM에서 현재 상품 정보 읽기.
  // price는 "가격문의" 상품이면 null — 이 경우도 관리자가 오버라이드로 가격을 지정하면
  // initProductActions()가 페이지를 실제 구매 가능한 형태로 보강합니다.
  function readProductFromPage() {
    var h1 = document.querySelector('.detail-info h1');
    if (!h1) return null;
    var priceEl = document.querySelector('.price-box .final-price');
    var price = priceEl ? parsePrice(priceEl.textContent) : NaN;
    var imgEl = document.querySelector('.detail-gallery .main-img');
    var brandEl = document.querySelector('.brand-line');
    var modelEl = document.querySelector('.detail-info .model');
    var image = '';
    if (imgEl) {
      var m = /url\((['"]?)(.*?)\1\)/.exec(imgEl.style.backgroundImage || '');
      if (m) image = m[2];
    }
    var file = location.pathname.split('/').pop() || '';
    var id = file.replace(/\.html$/, '') || h1.textContent.trim();
    return {
      id: id,
      name: h1.textContent.trim(),
      brand: brandEl ? brandEl.textContent.trim() : '',
      model: modelEl ? modelEl.textContent.trim() : '',
      price: price || null,
      image: image,
      url: file
    };
  }
  function getQtyFromPage() {
    var input = document.querySelector('.qty-selector input');
    return input ? (parseInt(input.value, 10) || 1) : 1;
  }

  function wireActionButtons(product, outlineBtns, primaryBtns) {
    outlineBtns.forEach(function (btn) {
      btn.onclick = function () {
        addToCart(product, getQtyFromPage());
        showToast('장바구니에 담았습니다');
      };
    });
    primaryBtns.forEach(function (btn) {
      btn.onclick = function () {
        addToCart(product, getQtyFromPage());
        location.href = 'checkout.html';
      };
    });
  }

  // 가격문의(가격 미확정) 상품용: 장바구니/바로구매를 실제 결제 대신 견적요청 담기로 연결
  function wireQuoteButtons(product, outlineBtns, primaryBtns, quickQuoteEls) {
    outlineBtns.forEach(function (btn) {
      btn.onclick = function () {
        addToQuoteDraft(product, getQtyFromPage());
        showToast('견적요청 목록에 담았습니다');
      };
    });
    primaryBtns.forEach(function (btn) {
      btn.onclick = function () {
        addToQuoteDraft(product, getQtyFromPage());
        location.href = 'quote-request.html';
      };
    });
    (quickQuoteEls || []).forEach(function (el) {
      el.onclick = function (e) {
        e.preventDefault();
        addToQuoteDraft(product, getQtyFromPage());
        location.href = 'quote-request.html';
      };
    });
  }

  function injectQtySelector(beforeEl) {
    if (document.querySelector('.qty-selector') || !beforeEl) return;
    var qtyRow = document.createElement('div');
    qtyRow.className = 'qty-row';
    qtyRow.innerHTML =
      '<span style="font-size:14px;">수량</span>' +
      '<div class="qty-selector">' +
        '<button type="button">-</button>' +
        '<input type="text" value="1">' +
        '<button type="button">+</button>' +
      '</div>';
    beforeEl.parentNode.insertBefore(qtyRow, beforeEl);
    qtyRow.querySelectorAll('.qty-selector button').forEach(function (btn) {
      btn.onclick = function () {
        var input = btn.parentElement.querySelector('input');
        var val = parseInt(input.value, 10) || 1;
        val = btn.textContent === '+' ? val + 1 : Math.max(1, val - 1);
        input.value = val;
      };
    });
  }

  // 상품 상세페이지: 장바구니/바로구매/견적서담기 버튼을 실제 동작에 연결.
  // 모든 상품 페이지에 3가지 액션을 보장합니다 — 가격이 있는 상품은 장바구니/바로구매가
  // 실제 결제로 이어지고, 가격문의 상품은 장바구니/바로구매도 견적요청 담기로 동작합니다.
  // 어느 쪽이든 "이 상품 견적서로 담기"는 항상 견적요청 목록에 담깁니다 — 고정가 상품도
  // 견적요청에 함께 넣어 다른 상품과 한 번에 견적받아 일괄 구매할 수 있습니다.
  function initProductActions() {
    var product = readProductFromPage();
    if (!product) return;

    var actionRow = document.querySelector('.action-row');
    var outlineBtns = Array.prototype.filter.call(
      document.querySelectorAll('.action-row .btn-outline'), function (b) { return b.tagName === 'BUTTON'; }
    );
    var primaryBtns = Array.prototype.filter.call(
      document.querySelectorAll('.action-row .btn-primary'), function (b) { return b.tagName === 'BUTTON'; }
    );

    // 가격문의 페이지 등 장바구니/바로구매 버튼이 아직 없으면 표준 2버튼 레이아웃으로 보강
    if (outlineBtns.length === 0 && primaryBtns.length === 0 && actionRow) {
      actionRow.innerHTML =
        '<button type="button" class="btn btn-outline btn-block">장바구니</button>' +
        '<button type="button" class="btn btn-primary btn-block">바로구매</button>';
      outlineBtns = Array.prototype.slice.call(actionRow.querySelectorAll('.btn-outline'));
      primaryBtns = Array.prototype.slice.call(actionRow.querySelectorAll('.btn-primary'));
      injectQtySelector(actionRow);
    }

    // "이 상품 견적서로 담기" 링크가 없으면 액션 로우 뒤에 추가
    var quickQuoteEls = Array.prototype.slice.call(document.querySelectorAll('.quick-quote'));
    if (quickQuoteEls.length === 0 && actionRow) {
      var qq = document.createElement('a');
      qq.href = 'quote-request.html';
      qq.className = 'quick-quote';
      qq.textContent = '이 상품 견적서로 담기 →';
      actionRow.parentNode.insertBefore(qq, actionRow.nextSibling);
      quickQuoteEls = [qq];
    }

    if (product.price) {
      // 고정가 상품: 장바구니/바로구매는 실제 구매로, 견적서 담기는 별도로 견적요청에 반영
      wireActionButtons(product, outlineBtns, primaryBtns);
      wireQuoteButtons(product, [], [], quickQuoteEls);
    } else {
      // 가격문의 상품: 아직 가격이 없으므로 3개 버튼 모두 견적요청 담기로 동작
      wireQuoteButtons(product, outlineBtns, primaryBtns, quickQuoteEls);
    }

    // 관리자가 설정한 가격/재고 오버라이드 반영. "가격문의" 상품이라도 관리자가
    // 판매가를 지정하면 이 페이지를 실제 구매 가능한 형태로 보강합니다.
    import('./papori-firebase.js').then(function (mod) {
      return mod.paporiGetProductOverride(product.id);
    }).then(function (override) {
      if (!override) return;
      var priceEl = document.querySelector('.price-box .final-price');

      if (typeof override.price === 'number' && override.price > 0) {
        product.price = override.price;
        if (priceEl) {
          priceEl.textContent = override.price.toLocaleString() + '원';
          priceEl.style.color = '';
        }
        var shipNote = document.querySelector('.price-box .ship-note');
        if (shipNote) shipNote.remove();

        // 지금까지는 견적요청 담기로 연결돼 있었을 버튼들을 실제 구매로 재연결
        wireActionButtons(product, outlineBtns, primaryBtns);
      }

      if (typeof override.stock === 'number' && override.stock <= 0) {
        outlineBtns.concat(primaryBtns).forEach(function (btn) {
          btn.disabled = true;
          btn.textContent = '품절';
          btn.style.opacity = '0.5';
          btn.style.cursor = 'not-allowed';
          btn.onclick = null;
        });
        if (priceEl) {
          var soldOut = document.createElement('span');
          soldOut.textContent = ' (품절)';
          soldOut.style.color = '#C0392B';
          soldOut.style.fontSize = '14px';
          priceEl.appendChild(soldOut);
        }
      }
    }).catch(function () { /* 오버라이드 조회 실패 시 페이지 기본값 그대로 사용 */ });
  }

  // 상품 목록 카드(카테고리 목록, 관련상품 등 .product-card 전부): 카드 상단에
  // 바로구매/장바구니/견적요청 3버튼을 추가. 가격이 있는 카드는 실제 구매로,
  // 가격문의 카드는 3버튼 모두 견적요청 담기로 동작 (상세페이지와 동일한 규칙).
  function initProductCardActions() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('a.product-card'));
    cards.forEach(function (oldCard) {
      var href = oldCard.getAttribute('href');
      var thumbEl = oldCard.querySelector('.thumb');
      var h4 = oldCard.querySelector('h4');
      if (!href || !thumbEl || !h4) return;

      var brandEl = oldCard.querySelector('.brand');
      var priceEl = oldCard.querySelector('.price');
      var image = '';
      var m = /url\((['"]?)(.*?)\1\)/.exec(thumbEl.style.backgroundImage || '');
      if (m) image = m[2];
      var price = priceEl ? parsePrice(priceEl.textContent) : NaN;

      var product = {
        id: href.replace(/\.html$/, ''),
        name: h4.textContent.trim(),
        brand: brandEl ? brandEl.textContent.trim() : '',
        model: '',
        price: price || null,
        image: image,
        url: href
      };

      var wrapper = document.createElement('div');
      wrapper.className = 'product-card';

      var actionsBar = document.createElement('div');
      actionsBar.className = 'card-quick-actions';
      actionsBar.innerHTML =
        '<button type="button" class="cqa-btn cqa-buy">바로구매</button>' +
        '<button type="button" class="cqa-btn cqa-cart">장바구니</button>' +
        '<button type="button" class="cqa-btn cqa-quote">견적요청</button>';

      var innerLink = document.createElement('a');
      innerLink.className = 'card-link';
      innerLink.href = href;
      while (oldCard.firstChild) innerLink.appendChild(oldCard.firstChild);

      wrapper.appendChild(actionsBar);
      wrapper.appendChild(innerLink);
      oldCard.replaceWith(wrapper);

      var buyBtn = actionsBar.querySelector('.cqa-buy');
      var cartBtn = actionsBar.querySelector('.cqa-cart');
      var quoteBtn = actionsBar.querySelector('.cqa-quote');

      quoteBtn.onclick = function (e) {
        e.preventDefault();
        addToQuoteDraft(product, 1);
        showToast('견적요청 목록에 담았습니다');
        location.href = 'quote-request.html';
      };
      if (product.price) {
        cartBtn.onclick = function (e) { e.preventDefault(); addToCart(product, 1); showToast('장바구니에 담았습니다'); };
        buyBtn.onclick = function (e) { e.preventDefault(); addToCart(product, 1); location.href = 'checkout.html'; };
      } else {
        cartBtn.onclick = function (e) { e.preventDefault(); addToQuoteDraft(product, 1); showToast('견적요청 목록에 담았습니다'); };
        buyBtn.onclick = function (e) { e.preventDefault(); addToQuoteDraft(product, 1); location.href = 'quote-request.html'; };
      }
    });
  }

  // cart.html: 실제 장바구니 내용을 테이블로 렌더링
  function renderCartPage() {
    var table = document.querySelector('.cart-table');
    var tbody = table ? table.querySelector('tbody') : null;
    if (!tbody) return;

    var cart = getCart();
    var emptyMsg = document.getElementById('cart-empty-msg');
    var summary = document.querySelector('.cart-summary');
    var actionsRow = document.getElementById('cart-actions-row');

    if (cart.length === 0) {
      tbody.innerHTML = '';
      table.style.display = 'none';
      if (summary) summary.style.display = 'none';
      if (actionsRow) actionsRow.style.display = 'none';
      if (emptyMsg) emptyMsg.style.display = 'block';
      return;
    }
    table.style.display = '';
    if (summary) summary.style.display = '';
    if (actionsRow) actionsRow.style.display = '';
    if (emptyMsg) emptyMsg.style.display = 'none';

    tbody.innerHTML = cart.map(function (item) {
      var qty = parseInt(item.qty, 10) || 1;
      return '' +
        '<tr data-id="' + escapeHtml(item.id) + '">' +
          '<td><div class="cart-item-name">' +
            '<a href="' + escapeHtml(item.url || '#') + '" class="thumb-sm" style="background-image:url(\'' + escapeHtml(item.image || '') + '\'); display:block;"></a>' +
            '<div><a href="' + escapeHtml(item.url || '#') + '" style="color:inherit;">' + escapeHtml(item.name) + '</a></div>' +
          '</div></td>' +
          '<td><div class="qty-selector" style="display:inline-flex;">' +
            '<button type="button" class="cart-qty-minus">-</button>' +
            '<input type="text" class="cart-qty-input" value="' + qty + '" style="width:40px; text-align:center;">' +
            '<button type="button" class="cart-qty-plus">+</button>' +
          '</div></td>' +
          '<td>' + (item.price * qty).toLocaleString() + '원</td>' +
          '<td>별도</td>' +
          '<td><span class="remove-btn cart-remove-btn" style="color:#C0392B; cursor:pointer;">삭제</span></td>' +
        '</tr>';
    }).join('');

    var total = cart.reduce(function (sum, i) { return sum + (i.price * (parseInt(i.qty, 10) || 1)); }, 0);
    var subtotalEl = document.getElementById('cart-subtotal');
    var grandtotalEl = document.getElementById('cart-grandtotal');
    if (subtotalEl) subtotalEl.textContent = total.toLocaleString() + '원';
    if (grandtotalEl) grandtotalEl.textContent = total.toLocaleString() + '원 + 배송비';

    tbody.querySelectorAll('tr').forEach(function (tr) {
      var id = tr.getAttribute('data-id');
      tr.querySelector('.cart-remove-btn').onclick = function () { removeFromCart(id); renderCartPage(); };
      tr.querySelector('.cart-qty-minus').onclick = function () {
        var input = tr.querySelector('.cart-qty-input');
        setQty(id, Math.max(1, (parseInt(input.value, 10) || 1) - 1));
        renderCartPage();
      };
      tr.querySelector('.cart-qty-plus').onclick = function () {
        var input = tr.querySelector('.cart-qty-input');
        setQty(id, (parseInt(input.value, 10) || 1) + 1);
        renderCartPage();
      };
      tr.querySelector('.cart-qty-input').onchange = function (e) {
        setQty(id, parseInt(e.target.value, 10) || 1);
        renderCartPage();
      };
    });
  }

  // 다른 페이지(checkout.html 등)에서 쓸 수 있도록 공개 API로 노출
  window.PaporiCart = {
    getCart: getCart,
    addToCart: addToCart,
    removeFromCart: removeFromCart,
    setQty: setQty,
    clearCart: clearCart,
    cartCount: cartCount,
    parsePrice: parsePrice,
    escapeHtml: escapeHtml,
    getQuoteDraft: getQuoteDraft,
    addToQuoteDraft: addToQuoteDraft,
    clearQuoteDraft: clearQuoteDraft
  };

  // 헤더 "로그인" 링크를 실제 로그인 상태에 맞춰 갱신 (로그인 시 이메일 표시 + 로그아웃)
  function initAuthState() {
    var loginLink = document.querySelector('.header-actions a[href="login.html"]');
    if (!loginLink) return;
    import('./papori-firebase.js').then(function (mod) {
      mod.paporiOnAuthChange(function (user) {
        if (user) {
          var wrap = document.createElement('span');
          wrap.id = 'papori-auth-state';
          wrap.innerHTML =
            '<a href="mypage.html">' + escapeHtml(user.email || '내 계정') + '</a> · ' +
            '<a href="#" id="papori-logout-link">로그아웃</a>';
          loginLink.replaceWith(wrap);
          document.getElementById('papori-logout-link').onclick = function (e) {
            e.preventDefault();
            mod.paporiLogout().then(function () { location.reload(); });
          };
        } else {
          var existing = document.getElementById('papori-auth-state');
          if (existing) {
            var restored = document.createElement('a');
            restored.href = 'login.html';
            restored.textContent = '로그인';
            existing.replaceWith(restored);
          } else {
            loginLink.textContent = '로그인';
            loginLink.href = 'login.html';
            loginLink.onclick = null;
          }
        }
      });
    }).catch(function () { /* firebase 로드 실패 시 기본 "로그인" 링크 그대로 둠 */ });
  }

  // 관리자 화면(admin.html)에서 저장한 사이트 기본정보로 푸터를 실시간 갱신
  // (Firestore에 아직 아무 값도 저장 안 돼 있으면 페이지에 있는 기본값을 그대로 둠)
  function applySiteConfig() {
    var footerInfo = document.querySelector('.footer-info');
    if (!footerInfo) return;
    import('./papori-firebase.js').then(function (mod) {
      return mod.paporiGetSiteConfig();
    }).then(function (cfg) {
      if (!cfg) return;
      var divs = footerInfo.querySelectorAll('div');
      if (divs[0] && cfg.businessName) {
        divs[0].textContent = '상호 ' + cfg.businessName +
          (cfg.ceo ? ' · 대표자 ' + cfg.ceo : '') +
          (cfg.phone ? ' · 대표전화 ' + cfg.phone : '') +
          (cfg.csPhone ? ' · 고객센터 ' + cfg.csPhone : '');
      }
      if (divs[1] && cfg.address) divs[1].textContent = '사업장 주소 ' + cfg.address;
      if (divs[2] && (cfg.bizRegNo || cfg.mailOrderNo)) {
        divs[2].textContent = (cfg.bizRegNo ? '사업자등록번호 ' + cfg.bizRegNo : '') +
          (cfg.bizRegNo && cfg.mailOrderNo ? ' · ' : '') +
          (cfg.mailOrderNo ? '통신판매업신고 ' + cfg.mailOrderNo : '');
      }
    }).catch(function () { /* 조회 실패 시 페이지 기본값 그대로 사용 */ });
  }

  // products-data.js가 아직 로드 안 된 페이지(대부분의 페이지)라면 동적으로 불러옴
  function ensureProductsData(cb) {
    if (window.PAPORI_PRODUCTS) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'products-data.js';
    s.onload = cb;
    s.onerror = cb; // 실패해도 검색 결과 없음으로 처리하고 진행
    document.head.appendChild(s);
  }

  // 헤더 검색창(제품명, 모델명 검색)을 실제 검색으로 연결 — 이전엔 아무 동작도 없었음
  function initHeaderSearch() {
    var box = document.querySelector('.search-box');
    var input = box ? box.querySelector('input') : null;
    if (!box || !input) return;
    box.style.position = 'relative';

    var list = document.createElement('div');
    list.className = 'autocomplete-list';
    box.appendChild(list);

    function renderMatches(matches, query) {
      if (matches.length === 0) {
        list.innerHTML = '<div class="autocomplete-empty">"' + escapeHtml(query) + '" 검색 결과가 없습니다.</div>';
        list.classList.add('show');
        return;
      }
      list.innerHTML = matches.map(function (p) {
        return '<div class="autocomplete-item">' +
          '<div><div class="ac-name">' + escapeHtml(p.name) + '</div>' +
          '<div class="ac-meta">' + escapeHtml(p.category || '') + (p.model ? ' · ' + escapeHtml(p.model) : '') + '</div></div>' +
          '</div>';
      }).join('');
      list.classList.add('show');
      Array.prototype.forEach.call(list.querySelectorAll('.autocomplete-item'), function (el, i) {
        el.onclick = function () { location.href = matches[i].url; };
      });
    }

    function search(query) {
      query = (query || '').trim();
      if (!query) { list.classList.remove('show'); return []; }
      var q = query.toLowerCase();
      var matches = (window.PAPORI_PRODUCTS || []).filter(function (p) {
        return (p.name && p.name.toLowerCase().indexOf(q) !== -1) ||
          (p.model && p.model.toLowerCase().indexOf(q) !== -1) ||
          (p.category && p.category.toLowerCase().indexOf(q) !== -1);
      }).slice(0, 8);
      renderMatches(matches, query);
      return matches;
    }

    input.addEventListener('input', function () {
      ensureProductsData(function () { search(input.value); });
    });
    input.addEventListener('focus', function () {
      if (input.value.trim()) ensureProductsData(function () { search(input.value); });
    });
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      ensureProductsData(function () {
        var matches = search(input.value);
        if (matches.length > 0) location.href = matches[0].url;
      });
    });
    document.addEventListener('click', function (e) {
      if (!box.contains(e.target)) list.classList.remove('show');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateBadge();
    initProductActions();
    initProductCardActions();
    renderCartPage();
    initAuthState();
    applySiteConfig();
    initHeaderSearch();
  });
})();
