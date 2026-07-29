function swapGalleryImage(el) {
  const gallery = el.closest('.detail-gallery');
  if (!gallery) return;
  const main = gallery.querySelector('.main-img');
  if (main) main.style.backgroundImage = el.style.backgroundImage;
  gallery.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}
