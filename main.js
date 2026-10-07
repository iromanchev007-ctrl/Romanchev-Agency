/*
 * Берёт контент из config.js (window.SITE) и подставляет его в страницу.
 * Обычно этот файл трогать не нужно: всё меняется в config.js.
 */
(function () {
  "use strict";

  var SITE = window.SITE || {};
  var root = document.documentElement;

  /* Пресеты темы: наборы CSS-переменных. Остальные оттенки (--accent-rgb, --accent-light, --on-accent)
     считаются автоматически из --accent и --accent-2. */
  var PRESETS = {
    violet: { "--accent": "#8b5cf6", "--accent-2": "#d946ef" },
    green: { "--accent": "#22c55e", "--accent-2": "#06b6d4" },
    orange: { "--accent": "#f97316", "--accent-2": "#f43f5e" },
  };
  var DEFAULT_PRESET = "violet";

  var CONTACT_TYPES = {
    telegram: { label: "Telegram", href: telegramHref },
    whatsapp: { label: "WhatsApp", href: whatsappHref },
    vk: { label: "VK", href: urlHref },
    email: { label: "Почта", href: emailHref, showValue: true },
    phone: { label: "Телефон", href: phoneHref, showValue: true },
    website: { label: "Сайт", href: urlHref },
  };

  var ARROW_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var CHECK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  /* ---------- Утилиты ---------- */

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function $all(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function get(path) {
    return path.split(".").reduce(function (obj, key) {
      return obj == null ? undefined : obj[key];
    }, SITE);
  }

  function isFilled(value) {
    return value != null && String(value).trim() !== "";
  }

  // Ставит текст в элемент. Слова через дефис («ИИ-боты», «бьюти-мастер») не разрываются при переносе строки.
  function setText(node, text) {
    node.textContent = "";
    String(text)
      .trim()
      .split(/([^\s-]+(?:-[^\s-]+)+)/)
      .forEach(function (part, i) {
        if (!part) return;
        if (i % 2) {
          var word = document.createElement("span");
          word.className = "nowrap";
          word.textContent = part;
          node.appendChild(word);
        } else {
          node.appendChild(document.createTextNode(part));
        }
      });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (isFilled(text)) setText(node, text);
    return node;
  }

  function list(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function isExternal(href) {
    return /^(https?:)?\/\//i.test(href);
  }

  function setLink(node, href) {
    node.href = href;
    if (isExternal(href)) {
      node.target = "_blank";
      node.rel = "noopener noreferrer";
    }
  }

  /* ---------- Тема: цвета и шрифт ---------- */

  var colorCtx = null;

  // Переводит любой CSS-цвет ("#f80", "tomato", "rgb(...)", "hsl(...)") в [r, g, b]. null — если цвет не распознан.
  function toRgb(color) {
    if (!isFilled(color)) return null;
    try {
      if (!colorCtx) {
        var canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        colorCtx = canvas.getContext("2d", { willReadFrequently: true });
      }
      if (!colorCtx) return null;
      var probe = "#010203";
      colorCtx.fillStyle = probe;
      colorCtx.fillStyle = String(color).trim();
      if (colorCtx.fillStyle === probe && String(color).trim().toLowerCase() !== probe) return null;
      colorCtx.clearRect(0, 0, 1, 1);
      colorCtx.fillRect(0, 0, 1, 1);
      var d = colorCtx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    } catch (e) {
      return null;
    }
  }

  function rgbString(rgb) {
    return "rgb(" + rgb.join(", ") + ")";
  }

  function mix(rgb, target, amount) {
    return rgb.map(function (c, i) {
      return Math.round(c + (target[i] - c) * amount);
    });
  }

  function luminance(rgb) {
    var c = rgb.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  // Сдвигает оттенок цвета: из одного акцента получаем второй цвет для градиентов.
  function shiftHue(rgb, degrees) {
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2, h = 0, s = 0, d = max - min;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    h = (((h + degrees) % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var parts = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return parts.map(function (v) {
      return Math.round((v + m) * 255);
    });
  }

  function applyTheme(theme) {
    theme = theme || {};
    var name = String(theme.preset || DEFAULT_PRESET).toLowerCase().trim();
    var preset = PRESETS[name];
    if (!preset) {
      console.warn('[config] Неизвестный пресет темы "' + theme.preset + '". Доступны: ' + Object.keys(PRESETS).join(", "));
      preset = PRESETS[DEFAULT_PRESET];
    }
    var vars = {};
    Object.keys(preset).forEach(function (key) {
      vars[key] = preset[key];
    });

    var accent = toRgb(vars["--accent"]);
    var accent2 = toRgb(vars["--accent-2"]);

    if (isFilled(theme.accent)) {
      var custom = toRgb(theme.accent);
      if (custom) {
        accent = custom;
        accent2 = shiftHue(custom, 35);
      } else {
        console.warn('[config] Не удалось распознать цвет theme.accent: "' + theme.accent + '"');
      }
    }

    if (isFilled(theme.font)) loadFont(String(theme.font).trim());

    // Если браузер не смог посчитать цвета, остаются значения по умолчанию из styles.css.
    if (!accent || !accent2) return;

    vars["--accent"] = rgbString(accent);
    vars["--accent-rgb"] = accent.join(", ");
    vars["--accent-2"] = rgbString(accent2);
    vars["--accent-2-rgb"] = accent2.join(", ");
    vars["--accent-light"] = rgbString(mix(accent, [255, 255, 255], 0.38));
    // На светлом акценте — тёмный текст кнопки, на тёмном — белый.
    vars["--on-accent"] = luminance(accent) > 0.3 ? "#0b0b0e" : "#ffffff";

    Object.keys(vars).forEach(function (key) {
      root.style.setProperty(key, vars[key]);
    });
  }

  function loadFont(name) {
    var family = encodeURIComponent(name).replace(/%20/g, "+");
    var base = "https://fonts.googleapis.com/css2?family=" + family;
    // Не у всех шрифтов есть все начертания. Если Google Fonts отвечает ошибкой — пробуем проще.
    var attempts = [
      base + ":wght@400;500;600;700;800&display=swap",
      base + ":wght@400;700&display=swap",
      base + "&display=swap",
    ];
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.onerror = function () {
      attempts.shift();
      if (attempts.length) {
        link.href = attempts[0];
      } else {
        console.warn('[config] Шрифт "' + name + '" не найден на Google Fonts');
      }
    };
    link.href = attempts[0];
    document.head.appendChild(link);
    root.style.setProperty("--font", '"' + name.replace(/"/g, "") + '", var(--font-fallback)');
  }

  /* ---------- Тексты ---------- */

  // Все элементы с data-text="путь.в.конфиге" получают текст из конфига. Пусто — элемент скрывается.
  function fillTexts() {
    $all("[data-text]").forEach(function (node) {
      var value = get(node.getAttribute("data-text"));
      if (isFilled(value)) {
        setText(node, value);
      } else {
        node.hidden = true;
      }
    });
  }

  function fillBrand() {
    var brand = SITE.brand || {};

    // Фото на первом экране: пока файла нет — градиентная заглушка, "" — блок скрыт.
    var media = $("[data-hero-media]");
    if (isFilled(brand.image)) {
      var img = el("img");
      img.alt = brand.imageAlt || "";
      img.decoding = "async";
      img.setAttribute("fetchpriority", "high");
      img.onerror = function () {
        img.replaceWith(placeholder(1));
      };
      img.src = brand.image;
      media.appendChild(img);
    } else {
      media.hidden = true;
      $(".hero").classList.add("hero--no-media");
    }

    // Эмблема рядом с названием в шапке и футере. Не загрузилась — остаётся цветной квадратик.
    if (isFilled(brand.logo)) {
      $all(".logo").forEach(function (logo) {
        var mark = el("img", "logo__img");
        mark.alt = "";
        mark.onload = function () {
          logo.classList.add("logo--image");
        };
        mark.onerror = function () {
          mark.remove();
        };
        mark.src = brand.logo;
        logo.insertBefore(mark, logo.firstChild);
      });
    }

    if (isFilled(brand.favicon)) {
      var icon = $('link[rel="icon"]') || document.head.appendChild(el("link"));
      icon.rel = "icon";
      var ext = String(brand.favicon).split("?")[0].split(".").pop().toLowerCase();
      var types = { svg: "image/svg+xml", png: "image/png", ico: "image/x-icon", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
      if (types[ext]) icon.type = types[ext];
      else icon.removeAttribute("type");
      icon.href = brand.favicon;
    }
  }

  function fillButtons() {
    var link = get("cta.link");
    $all("[data-cta-link]").forEach(function (btn) {
      var label = $("[data-text]", btn);
      if (!isFilled(link) || (label && label.hidden)) {
        btn.hidden = true;
        return;
      }
      setLink(btn, String(link).trim());
    });
  }

  /* ---------- Секции ---------- */

  function hideSectionIfEmpty(name, items) {
    if (!items.length) {
      var section = $('[data-section="' + name + '"]');
      if (section) section.hidden = true;
      return true;
    }
    return false;
  }

  function renderServices() {
    var items = list(SITE.services);
    if (hideSectionIfEmpty("services", items)) return;
    var container = $("[data-services]");

    items.forEach(function (item, i) {
      var card = el("article", "card service reveal");
      card.style.setProperty("--delay", i * 0.08 + "s");
      card.appendChild(el("span", "service__num", String(i + 1).padStart(2, "0")));
      if (isFilled(item.title)) card.appendChild(el("h3", "service__title", item.title));
      if (isFilled(item.text)) card.appendChild(el("p", "service__text", item.text));
      container.appendChild(card);
    });
  }

  // Позиции бликов для градиентных заглушек, чтобы соседние выглядели по-разному.
  var GLOWS = [
    ["22%", "28%", "88%", "85%"],
    ["80%", "25%", "15%", "90%"],
    ["50%", "10%", "85%", "95%"],
    ["15%", "80%", "80%", "15%"],
  ];

  function placeholder(index) {
    var node = el("div", "placeholder");
    var g = GLOWS[index % GLOWS.length];
    node.style.setProperty("--glow-x", g[0]);
    node.style.setProperty("--glow-y", g[1]);
    node.style.setProperty("--glow2-x", g[2]);
    node.style.setProperty("--glow2-y", g[3]);
    return node;
  }

  function renderCases() {
    var items = list(SITE.cases);
    if (hideSectionIfEmpty("cases", items)) return;
    var container = $("[data-cases]");
    var labels = SITE.caseLabels || {};

    items.forEach(function (item, i) {
      var card = el("article", "card case reveal");
      card.style.setProperty("--delay", (i % 2) * 0.1 + "s");

      // Картинка или заглушка
      var media = el("div", "case__media");
      if (isFilled(item.image)) {
        var img = el("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.alt = item.title || "";
        img.onerror = function () {
          img.replaceWith(placeholder(i));
        };
        img.src = item.image;
        media.appendChild(img);
      } else {
        media.appendChild(placeholder(i));
      }
      if (isFilled(item.niche)) media.appendChild(el("span", "case__tag", item.niche));
      card.appendChild(media);

      var body = el("div", "case__body");
      if (isFilled(item.title)) body.appendChild(el("h3", "case__title", item.title));

      var fields = el("dl", "case__fields");
      ["task", "done", "result"].forEach(function (key) {
        if (!isFilled(item[key])) return;
        var row = el("div");
        row.appendChild(el("dt", "case__label", labels[key] || key));
        row.appendChild(el("dd", "case__value", item[key]));
        fields.appendChild(row);
      });
      if (fields.children.length) body.appendChild(fields);

      if (isFilled(item.quote)) {
        var quote = el("figure", "case__quote");
        var text = el("blockquote", "case__quote-text", item.quote);
        quote.appendChild(text);
        if (isFilled(item.author)) quote.appendChild(el("figcaption", "case__author", "— " + String(item.author).trim()));
        body.appendChild(quote);
      }

      if (isFilled(item.link)) {
        var more = el("a", "case__more", labels.more || "Подробнее");
        setLink(more, String(item.link).trim());
        more.insertAdjacentHTML("beforeend", ARROW_ICON);
        body.appendChild(more);
      }

      card.appendChild(body);
      container.appendChild(card);
    });
  }

  function renderCtaPoints() {
    var container = $("[data-cta-points]");
    var points = list(get("cta.points")).filter(isFilled);
    if (!points.length) {
      container.hidden = true;
      return;
    }
    points.forEach(function (point) {
      var li = el("li", "cta__point");
      var check = el("span", "cta__check");
      check.innerHTML = CHECK_ICON;
      li.appendChild(check);
      li.appendChild(el("span", "", point));
      container.appendChild(li);
    });
  }

  /* ---------- Контакты ---------- */

  function urlHref(value) {
    return /^[a-z]+:/i.test(value) || value.indexOf("//") === 0 ? value : "https://" + value;
  }

  function telegramHref(value) {
    if (/^@/.test(value)) return "https://t.me/" + value.slice(1);
    if (/^(https?:\/\/|tg:)/i.test(value)) return value;
    if (/^(t\.me|telegram\.me)\//i.test(value)) return "https://" + value;
    return "https://t.me/" + value;
  }

  function whatsappHref(value) {
    if (/^(https?:\/\/|whatsapp:)/i.test(value)) return value;
    if (/^[\d\s()+-]+$/.test(value)) return "https://wa.me/" + value.replace(/\D/g, "");
    return urlHref(value);
  }

  function emailHref(value) {
    return /^mailto:/i.test(value) ? value : "mailto:" + value;
  }

  function phoneHref(value) {
    return "tel:" + value.replace(/[^\d+]/g, "");
  }

  function renderContacts() {
    var container = $("[data-contacts]");
    var contacts = SITE.contacts || {};

    Object.keys(contacts).forEach(function (key) {
      var value = contacts[key];
      if (!isFilled(value)) return;
      value = String(value).trim();
      var type = CONTACT_TYPES[key.toLowerCase()] || { label: key, href: urlHref };

      var a = el("a", "contact", type.showValue ? value.replace(/^(mailto|tel):/i, "") : type.label);
      setLink(a, type.href(value));
      var li = el("li");
      li.appendChild(a);
      container.appendChild(li);
    });

    if (!container.children.length) container.hidden = true;
  }

  /* ---------- Поведение ---------- */

  function initHeader() {
    var header = $("[data-header]");
    var update = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  // Крупный заголовок hero: если самое длинное слово названия не влезает по ширине, уменьшаем шрифт.
  function fitHeroTitle() {
    var title = $(".hero__title");
    if (!title || title.hidden) return;
    title.style.fontSize = "";
    var words = title.textContent.split(/\s+/).filter(Boolean);
    var probe = el("span");
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;";
    title.appendChild(probe);
    var widest = 0;
    words.forEach(function (word) {
      probe.textContent = word;
      widest = Math.max(widest, probe.getBoundingClientRect().width);
    });
    title.removeChild(probe);
    var available = title.clientWidth;
    if (widest > available && available > 0) {
      var size = parseFloat(getComputedStyle(title).fontSize);
      title.style.fontSize = Math.floor((size * available) / widest) + "px";
    }
  }

  function initFitTitle() {
    var frame = 0;
    var schedule = function () {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fitHeroTitle);
    };
    fitHeroTitle();
    window.addEventListener("resize", schedule);
    window.addEventListener("load", schedule);
    // ширина слов меняется, когда догружается шрифт с Google Fonts
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener("loadingdone", schedule);
    }
  }

  function initReveal() {
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) return;

    root.classList.add("js-reveal");
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    $all(".reveal").forEach(function (node) {
      observer.observe(node);
    });
  }

  /* ---------- Запуск ---------- */

  function run(step) {
    try {
      step();
    } catch (e) {
      // Ошибка в одном блоке не должна ломать остальную страницу.
      console.error(e);
    }
  }

  if (!window.SITE) {
    console.error("config.js не загрузился или в нём ошибка: проверьте запятые и кавычки.");
  }

  run(function () {
    applyTheme(SITE.theme);
  });
  run(fillTexts);
  run(fillBrand);
  run(fillButtons);
  run(renderServices);
  run(renderCases);
  run(renderCtaPoints);
  run(renderContacts);
  run(function () {
    $("[data-year]").textContent = new Date().getFullYear();
  });
  run(initHeader);
  run(initFitTitle);
  run(initReveal);
})();
