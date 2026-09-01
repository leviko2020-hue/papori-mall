// PAPORI 상품 목록 정렬 (카테고리 페이지 공통)
// filter-bar 안의 <select>와 .product-grid를 찾아서 정렬 옵션에 따라 카드 순서를 바꿉니다.
// "인기순"은 실제 판매 데이터가 쌓이기 전까지 원래(브랜드 그룹) 순서로 취급합니다.
document.addEventListener('DOMContentLoaded', function () {
  var select = document.querySelector('.filter-bar select');
  var grid = document.querySelector('.product-grid');
  if (!select || !grid) return;

  var originalHTML = grid.innerHTML; // 브랜드 그룹 헤딩 포함 원래 순서 보관

  function priceOf(card) {
    var priceEl = card.querySelector('.price');
    if (!priceEl) return Infinity; // 견적문의 등 가격 없는 상품은 항상 맨 뒤
    var digits = priceEl.textContent.replace(/[^\d]/g, '');
    return digits ? parseInt(digits, 10) : Infinity;
  }

  select.addEventListener('change', function () {
    var mode = select.value;

    if (mode === '인기순') {
      grid.innerHTML = originalHTML; // 브랜드 그룹 헤딩 포함 원상복구
      return;
    }

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.product-card'));

    if (mode === '낮은 가격순') {
      cards.sort(function (a, b) { return priceOf(a) - priceOf(b); });
    } else if (mode === '높은 가격순') {
      cards.sort(function (a, b) {
        var pa = priceOf(a), pb = priceOf(b);
        if (pa === Infinity && pb === Infinity) return 0;
        if (pa === Infinity) return 1;  // 견적문의는 높은순에서도 항상 맨 뒤
        if (pb === Infinity) return -1;
        return pb - pa;
      });
    } else if (mode === '신상품순') {
      cards.reverse(); // 등록 순서상 가장 나중에 추가된 상품을 최신으로 간주(근사치)
    }

    grid.innerHTML = '';
    cards.forEach(function (c) { grid.appendChild(c); });
  });
});
