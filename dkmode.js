(function () {
  // 🌙 Create or reuse toggle button
  let existingBtn = document.getElementById("darkLightToggleBtn");
  if (existingBtn) return; // avoid duplicates

  const btn = document.createElement("button");
  btn.id = "darkLightToggleBtn";
  btn.innerHTML = "🌙";
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: 99999,
    background: "linear-gradient(135deg, #ff6b35, #ff8c42)",
    border: "none",
    borderRadius: "50%",
    width: "55px",
    height: "55px",
    color: "#fff",
    fontSize: "1.4rem",
    cursor: "pointer",
    boxShadow: "0 0 20px rgba(0,0,0,0.25)",
    transition: "all 0.3s ease",
  });
  btn.onmouseover = () => (btn.style.transform = "scale(1.1)");
  btn.onmouseout = () => (btn.style.transform = "scale(1)");

  document.body.appendChild(btn);

  // 🌓 Create dark & light mode style blocks
  const darkStyle = `
    :root {
      --bg: #000;
      --text: #fff;
      --accent1: #ff6b35;
      --accent2: #ff8c42;
    }
    body, html {
      background: var(--bg) !important;
      color: var(--text) !important;
      transition: all 0.3s ease;
    }
    * {
      border-color: #444 !important;
      background-color: transparent;
    }
    a, button, h1, h2, h3, h4, h5, h6, p, span {
      color: var(--text) !important;
    }
  `;

  const lightStyle = `
    :root {
      --bg: #fff;
      --text: #000;
      --accent1: #0078ff;
      --accent2: #00aaff;
    }
    body, html {
      background: var(--bg) !important;
      color: var(--text) !important;
      transition: all 0.3s ease;
    }
    * {
      border-color: #ccc !important;
      background-color: transparent;
    }
    a, button, h1, h2, h3, h4, h5, h6, p, span {
      color: var(--text) !important;
    }
  `;

  const styleTag = document.createElement("style");
  styleTag.id = "darkLightStyle";
  document.head.appendChild(styleTag);

  // ☀️ Detect initial mode
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let darkMode = prefersDark;
  styleTag.innerHTML = darkMode ? darkStyle : lightStyle;
  btn.innerHTML = darkMode ? "☀️" : "🌙";

  // 🪄 Function to detect existing page brightness
  function detectBrightness() {
    const bgColor = window
      .getComputedStyle(document.body)
      .backgroundColor.match(/\d+/g);
    if (bgColor) {
      const avg = (parseInt(bgColor[0]) + parseInt(bgColor[1]) + parseInt(bgColor[2])) / 3;
      darkMode = avg < 128;
    }
  }
  detectBrightness();

  // 🔁 Toggle logic
  btn.onclick = () => {
    darkMode = !darkMode;
    styleTag.innerHTML = darkMode ? darkStyle : lightStyle;
    btn.innerHTML = darkMode ? "☀️" : "🌙";
    localStorage.setItem("darkLightMode", darkMode ? "dark" : "light");
  };

  // 🧠 Load last mode
  const savedMode = localStorage.getItem("darkLightMode");
  if (savedMode) {
    darkMode = savedMode === "dark";
    styleTag.innerHTML = darkMode ? darkStyle : lightStyle;
    btn.innerHTML = darkMode ? "☀️" : "🌙";
  }

  // 🔍 Auto inject into navbars (if any)
  const navbars = document.querySelectorAll("nav, header");
  if (navbars.length > 0) {
    navbars[0].appendChild(btn);
    Object.assign(btn.style, {
      position: "absolute",
      bottom: "auto",
      right: "20px",
      top: "10px",
    });
  }
})();
