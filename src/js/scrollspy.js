/*!
 * Copyright (c) 2019 by zchee (https://codepen.io/zchee/pen/ogzvZZ)
 * Released under the MIT license
 * http://opensource.org/licenses/mit-license.php
 */

(function () {
  'use strict';

  var section = document.querySelectorAll('.scroll-section');
  var sections = {};
  var i = 0;

  Array.prototype.forEach.call(section, function (e) {
    sections[e.id] = e.offsetTop;
  });

  window.onscroll = function () {
    var scrollPosition =
      document.documentElement.scrollTop || document.body.scrollTop;

    for (i in sections) {
      if (sections[i] <= scrollPosition) {
        document
          .querySelector('.side-menu-active')
          .classList.remove('side-menu-active');
        document
          .querySelector('a[href*=' + i + ']')
          .classList.add('side-menu-active');
      }
    }
  };
})();
