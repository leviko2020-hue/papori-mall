// PAPORI 장바구니 공용 스크립트 (localStorage 기반, 정적 사이트 전용— 서버 없이 브라우저에 저장)
// 모든 페이지 </body> 직전에 <script src="cart.js"></script>로 로드됨.
// - 상품 상세페이지: .action-row .btn-outline(장바구니)/.btn-primary(바로구매) 버튼을 실제 담기 동작에 연결
// - 헤더 .cart-badge: 담긴 수량 표시
// - cart.html: 실제 담긴 상품으로 테이블 렌더링
// - checkout.html: PaporiCart.getCart()를 통해 실제 장바구니 데이터 사용
(function () {
  var CART_KEY = 'papori_cart';

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

  // 상품 상세페이지 DOM에서 현재 상품 정보 읽기 (가격이 없는 "가격문의" 상품은 null 반환)
  function readProductFromPage() {
    var h1 = document.querySelector('.detail-info h1');
    var priceEl = document.querySelector('.price-box .final-price');
    if (!h1 || !priceEl) return null;
    var price = parsePrice(priceEl.textContent);
    if (!price) return null;
    var imgEl = document.querySelector('.detail-gallery .main-img');
    var brandEl = document.querySelector('.brand-line');
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
      price: price,
      image: image,
      url: file
    };
  }
  function getQtyFromPage() {
    var input = document.querySelector('.qty-selector input');
    return input ? (parseInt(input.value, 10) || 1) : 1;
  }

  // 상품 상세페이지: 장바구니/바로구매 버튼을 실제 동작에 연결
  function initProductActions() {
    var product = readProductFromPage();
    if (!product) return;

    document.querySelectorAll('.action-row .btn-outline').forEach(function (btn) {
      if (btn.tagName !== 'BUTTON') return;
      btn.onclick = function () {
        addToCart(product, getQtyFromPage());
        showToast('장바구니에 담았습니다');
      };
    });
    document.querySelectorAll('.action-row .btn-primary').forEach(function (btn) {
      if (btn.tagName !== 'BUTTON') return;
      btn.onclick = function () {
        addToCart(product, getQtyFromPage());
        location.href = 'checkout.html';
      };
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
    escapeHtml: escapeHtml
  };

  document.addEventListener('DOMContentLoaded', function () {
    updateBadge();
    initProductActions();
    renderCartPage();
  });
})();
