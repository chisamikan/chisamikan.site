document.addEventListener('DOMContentLoaded', function () {
  const userAgent = window.navigator.userAgent.toLocaleLowerCase();
  if (userAgent.indexOf('msie') != -1 || userAgent.indexOf('trident') != -1) {
    const forie = document.getElementById('forie');
    forie.style.display = 'flex';
    console.log(userAgent);

    // for win10
    if (userAgent.indexOf('windows nt 10') != -1) {
      const forwin10 = document.getElementById('forwin10');
      forwin10.style.display = 'inline-block';
    }
  }
});
