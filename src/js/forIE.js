document.addEventListener('DOMContentLoaded', function () {
  const userAgent = window.navigator.userAgent.toLocaleLowerCase();
  if (userAgent.indexOf('msie') != -1 || userAgent.indexOf('trident') != -1) {
    const forIE = document.getElementById('forIE');
    forIE.style.display = 'flex';
    console.log(userAgent);

    // for win10
    if (userAgent.indexOf('windows nt 10') != -1) {
      const forWin10 = document.getElementById('forWin10');
      forWin10.style.display = 'inline-block';
    }
  }
});
