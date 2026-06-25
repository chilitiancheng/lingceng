(function () {
  const data = window.LINGCENG_WORLD_DATA || { entries: [], categories: [] };
  const labels = {
    all: "全部",
    principles: "世界底层",
    characters: "角色",
    dreams: "梦境",
    factions: "阵营",
    locations: "地点组织",
    stories: "正文",
    notes: "其他"
  };

  let activeCategory = "all";
  let query = "";
  let fadeObserver = null;

  const $ = (selector) => document.querySelector(selector);
  const cardsGrid = $("#cardsGrid");
  const filterTabs = $("#filterTabs");
  const searchInput = $("#searchInput");
  const dialog = $("#detailDialog");
  const detailContent = $("#detailContent");
  const topbar = $(".topbar");

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function firstText(entry, length = 96) {
    return (entry.summary || entry.plain || "档案残缺，待解锁。").replace(/\s+/g, " ").slice(0, length);
  }

  function cardTemplate(entry) {
    const fields = Object.entries(entry.fields || {}).slice(0, 3);
    const meta = [labels[entry.category], entry.code, entry.status].filter(Boolean);
    return `
      <button class="card" data-id="${escapeHtml(entry.id)}">
        <div class="card-meta">
          ${meta.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}
        </div>
        <h3>${escapeHtml(entry.title)}</h3>
        <p>${escapeHtml(firstText(entry))}</p>
        <div class="card-meta">
          ${fields.map(([key, value]) => `<span class="pill">${escapeHtml(key)}：${escapeHtml(String(value).slice(0, 18))}</span>`).join("")}
        </div>
      </button>
    `;
  }

  function storyTemplate(entry, index) {
    return `
      <button class="story-row" data-id="${escapeHtml(entry.id)}">
        <div>
          <h3>${escapeHtml(entry.title)}</h3>
          <p>${escapeHtml(firstText(entry, 140))}</p>
        </div>
        <span>${String(index + 1).padStart(2, "0")}</span>
      </button>
    `;
  }

  function renderTabs() {
    if (!filterTabs) return;
    const categoryOrder = ["all", "principles", "characters", "dreams", "factions", "locations", "stories", "notes"];
    filterTabs.innerHTML = categoryOrder
      .filter((category) => category === "all" || data.entries.some((entry) => entry.category === category))
      .map((category) => `<button class="${category === activeCategory ? "active" : ""}" data-category="${category}">${labels[category]}</button>`)
      .join("");
  }

  function getFilteredEntries() {
    const normalized = query.trim().toLowerCase();
    return data.entries.filter((entry) => {
      const categoryMatch = activeCategory === "all" || entry.category === activeCategory;
      const queryMatch = !normalized || entry.searchText.toLowerCase().includes(normalized);
      return categoryMatch && queryMatch;
    });
  }

  function renderCards() {
    if (!cardsGrid) return;
    const entries = getFilteredEntries();
    cardsGrid.innerHTML = entries.length
      ? entries.map(cardTemplate).join("")
      : `<div class="empty-state">没有找到匹配档案。</div>`;
    registerFadeCards(cardsGrid);
  }

  function renderSection(selector, category, template = cardTemplate) {
    const root = $(selector);
    const normalized = query.trim().toLowerCase();
    const entries = data.entries.filter((entry) => {
      const categoryMatch = entry.category === category;
      const queryMatch = !normalized || entry.searchText.toLowerCase().includes(normalized);
      return categoryMatch && queryMatch;
    });
    root.innerHTML = entries.length
      ? entries.map((entry, index) => template(entry, index)).join("")
      : `<div class="empty-state">暂无档案。</div>`;
    registerFadeCards(root);
  }

  function renderContentSections() {
    renderSection("#principleList", "principles");
    renderSection("#characterGrid", "characters");
    renderSection("#dreamGrid", "dreams");
    renderSection("#factionGrid", "factions");
    renderSection("#storyList", "stories", storyTemplate);
  }
  function renderCanvasMap() {
    const root = $("#canvasMap");
    if (!root) return;
    const canvas = data.canvas;
    if (!canvas || !canvas.nodes?.length) {
      root.innerHTML = `<div class="empty-state">未找到 Obsidian 白板关系图。</div>`;
      return;
    }
    const nodeById = new Map(canvas.nodes.map((node) => [node.id, node]));
    const fileNodes = canvas.nodes.filter((node) => node.type === "file");
    const textNotes = canvas.nodes.filter((node) => node.type === "text").map((node) => node.label).filter(Boolean);
    const entryForNode = (node) => node.file ? findByLinkName(node.file) : null;
    const itemButton = (name) => {
      const entry = data.entries.find((item) => item.title === name || item.basename === name);
      return `<button class="relation-chip" ${entry ? `data-id="${escapeHtml(entry.id)}"` : ""}>${escapeHtml(name)}</button>`;
    };
    const fileButton = (node) => {
      const entry = entryForNode(node);
      return `<button class="relation-chip" ${entry ? `data-id="${escapeHtml(entry.id)}"` : ""}>${escapeHtml(node.label)}</button>`;
    };
    const nodeByName = new Map(fileNodes.map((node) => [node.label, node]));
    const edgeRows = canvas.edges.map((edge) => {
      const from = nodeById.get(edge.fromNode);
      const to = nodeById.get(edge.toNode);
      if (!from || !to) return "";
      return `
        <li>
          <span>${escapeHtml(from.label)}</span>
          <strong>${escapeHtml(edge.label || "关联")}</strong>
          <span>${escapeHtml(to.label)}</span>
        </li>
      `;
    }).join("");

    const group = (title, note, names) => `
      <article class="relation-group">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(note)}</p>
        <div class="relation-chips">
          ${names.map((name) => nodeByName.has(name) ? fileButton(nodeByName.get(name)) : itemButton(name)).join("")}
        </div>
      </article>
    `;

    root.innerHTML = `
      <div class="relation-board">
        <section class="relation-overview">
          <article>
            <span>最高位</span>
            <h3>命运 → 命运线 → 命神 → 灵层/初始宇宙</h3>
            <p>命运创造命运线；命神传输命运线；命运线被给予到灵层方与初始宇宙方，成为权柄与异能的源头。</p>
          </article>
          <article>
            <span>主冲突</span>
            <h3>灵层方 ↔ 初始宇宙方</h3>
            <p>白板中两方关系被标记为“绝对敌对”。灵层需要存续，初始宇宙需要抵抗被吞并。</p>
          </article>
        </section>

        <section class="relation-columns">
          ${group("灵层激进派", "主张替代初始宇宙的自我。内部以鼠为核心，和保守派理念不同。", ["鼠", "马", "羊", "鸡"])}
          ${group("灵层保守派", "主张融合灵层与初始宇宙。龙与蛇存在异位面同位体关系，猪延伸出妒源教。", ["龙", "蛇", "猪", "教会：妒源教"])}
          ${group("中立派", "不明确倒向任何一方，但和多派存在合作、招聘或上下级关系。", ["牛", "猴", "兔", "狗"])}
          ${group("混乱阵营", "只追求权力。虎与鼠为宿敌，又能与蛇、猪发生合作或祭祀关系。", ["虎"])}
          ${group("初始宇宙方", "联邦、监管局与民间组织互相警惕、围剿或竞争，共同面对灵层威胁。", ["联邦", "监管局", "民间组织：默"])}
          ${group("核心概念", "这组不是阵营，而是世界运行的上层结构。", ["命运", "命运线", "命神"])}
        </section>

        <section class="relation-notes">
          <h3>白板注释</h3>
          <div class="relation-chips muted">
            ${textNotes.map((note) => `<span>${escapeHtml(note)}</span>`).join("")}
          </div>
        </section>

        <section class="relation-list">
          <h3>关系明细</h3>
          <ul>${edgeRows}</ul>
        </section>
      </div>
    `;
    registerFadeCards(root);
  }

  function markdownToHtml(markdown) {
    const linked = String(markdown || "")
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, target, label) => `<button class="inline-link" data-link="${escapeHtml(target)}">${escapeHtml(label)}</button>`)
      .replace(/\[\[([^\]]+)\]\]/g, (_, target) => `<button class="inline-link" data-link="${escapeHtml(target)}">${escapeHtml(target)}</button>`);

    const lines = linked.split(/\r?\n/);
    const html = [];
    let inList = false;

    const closeList = () => {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
    };

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        closeList();
        continue;
      }
      if (/^---+$/.test(line.trim())) {
        closeList();
        html.push("<hr />");
        continue;
      }
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        closeList();
        const level = heading[1].length + 1;
        html.push(`<h${level}>${heading[2]}</h${level}>`);
        continue;
      }
      const list = line.match(/^\s*[-·]\s+(.+)$/);
      if (list) {
        if (!inList) {
          html.push("<ul>");
          inList = true;
        }
        html.push(`<li>${list[1]}</li>`);
        continue;
      }
      closeList();
      html.push(`<p>${line}</p>`);
    }
    closeList();
    return html.join("");
  }

  function findByLinkName(name) {
    const clean = String(name || "").replace(/\.md$/, "");
    return data.entries.find((entry) => entry.title === clean || entry.basename === clean || entry.path.endsWith(`${clean}.md`));
  }

  function decryptTextElement(element, delay = 0) {
    const original = element.textContent;
    if (!original || !original.trim()) return;
    const chars = "ABCD1234!?LINGCENG";
    const speed = 110;
    const maxIterations = 20;
    const letters = Array.from(original);
    let iteration = 0;

    element.dataset.originalText = original;
    element.textContent = letters.map((char) => (char.trim() ? "" : char)).join("");

    window.setTimeout(() => {
      const timer = window.setInterval(() => {
        iteration += 1;
        const revealLimit = (iteration / maxIterations) * letters.length;
        element.textContent = letters.map((char, index) => {
          if (char.trim() === "") return char;
          if (index < revealLimit) return char;
          return chars[Math.floor(Math.random() * chars.length)];
        }).join("");

        if (iteration >= maxIterations) {
          window.clearInterval(timer);
          element.textContent = original;
          element.classList.add("decrypted-text-done");
        }
      }, speed);
    }, delay);
  }

  function decryptDetailText() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = detailContent.querySelectorAll(".detail-content h2, .detail-content h3, .detail-content p, .detail-content li, .detail-fields .pill");
    targets.forEach((target, index) => {
      target.classList.add("decrypting-text");
      decryptTextElement(target, Math.min(index, 14) * 90);
    });
  }

  function openEntry(entry) {
    if (!entry) return;
    const fields = Object.entries(entry.fields || {});
    detailContent.innerHTML = `
      <div class="detail-content">
        <div class="card-meta">
          <span class="pill">${escapeHtml(labels[entry.category])}</span>
          ${entry.code ? `<span class="pill">${escapeHtml(entry.code)}</span>` : ""}
          ${entry.status ? `<span class="pill">${escapeHtml(entry.status)}</span>` : ""}
        </div>
        <h2>${escapeHtml(entry.title)}</h2>
        <div class="detail-fields">
          ${fields.map(([key, value]) => `<span class="pill">${escapeHtml(key)}：${escapeHtml(value)}</span>`).join("")}
        </div>
        ${markdownToHtml(escapeHtml(entry.content))}
        <hr />
        <p>来源：${escapeHtml(entry.path)}</p>
      </div>
    `;
    dialog.showModal();
    decryptDetailText();
  }

  document.addEventListener("click", (event) => {
    const card = event.target.closest("[data-id]");
    if (card) {
      openEntry(data.entries.find((entry) => entry.id === card.dataset.id));
      return;
    }

    const tab = event.target.closest("[data-category]");
    if (tab) {
      activeCategory = tab.dataset.category;
      renderTabs();
      renderCards();
      return;
    }

    const inline = event.target.closest("[data-link]");
    if (inline) {
      const entry = findByLinkName(inline.dataset.link);
      if (entry) openEntry(entry);
    }
  });

  $("#closeDialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  searchInput?.addEventListener("input", (event) => {
    query = event.target.value;
    renderCards();
    renderContentSections();
  });

  function updateTopbarState() {
    topbar?.classList.toggle("scrolled", window.scrollY > 24);
  }

  function initIntroCardNav() {
    const nav = $("#introCardNav");
    if (!nav) return;
    const toggle = nav.querySelector(".hamburger-menu");
    const cards = Array.from(nav.querySelectorAll(".nav-card"));
    const setOpen = (open) => {
      nav.classList.toggle("open", open);
      toggle?.setAttribute("aria-expanded", String(open));
      if (open) cards.forEach((card) => card.classList.add("fade-visible"));
    };

    toggle?.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
    toggle?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      setOpen(!nav.classList.contains("open"));
    });
  }
  function initTargetCursor() {
    const cursor = $(".target-cursor");
    if (!cursor || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const corners = Array.from(cursor.querySelectorAll(".target-cursor-corner"));
    const dot = cursor.querySelector(".target-cursor-dot");
    const targetSelector = "a, button, input, .card, .feature-item, .story-row, .relation-chip, .card-nav, .nav-card";
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = mouseX;
    let cursorY = mouseY;
    let activeTarget = null;
    let rotation = 0;

    document.body.classList.add("cursor-ready");

    const setCorner = (corner, x, y) => {
      corner.style.transform = `translate(${x}px, ${y}px)`;
    };

    const resetCorners = () => {
      setCorner(corners[0], -24, -24);
      setCorner(corners[1], 10, -24);
      setCorner(corners[2], 10, 10);
      setCorner(corners[3], -24, 10);
    };

    const lockToTarget = (target) => {
      const rect = target.getBoundingClientRect();
      const size = 14;
      setCorner(corners[0], rect.left - cursorX - 4, rect.top - cursorY - 4);
      setCorner(corners[1], rect.right - cursorX - size + 4, rect.top - cursorY - 4);
      setCorner(corners[2], rect.right - cursorX - size + 4, rect.bottom - cursorY - size + 4);
      setCorner(corners[3], rect.left - cursorX - 4, rect.bottom - cursorY - size + 4);
    };

    const frame = () => {
      cursorX += (mouseX - cursorX) * 0.22;
      cursorY += (mouseY - cursorY) * 0.22;
      rotation = activeTarget ? 0 : rotation + 1.8;
      cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0) rotate(${rotation}deg)`;
      if (activeTarget && document.body.contains(activeTarget)) lockToTarget(activeTarget);
      window.requestAnimationFrame(frame);
    };

    window.addEventListener("mousemove", (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      cursor.classList.add("active");
    });

    window.addEventListener("mousedown", () => {
      if (dot) dot.style.transform = "translate(-50%, -50%) scale(0.72)";
      cursor.style.scale = "0.94";
    });

    window.addEventListener("mouseup", () => {
      if (dot) dot.style.transform = "translate(-50%, -50%) scale(1)";
      cursor.style.scale = "1";
    });

    document.addEventListener("mouseover", (event) => {
      const target = event.target.closest(targetSelector);
      if (!target) return;
      activeTarget = target;
      cursor.classList.add("locked");
      lockToTarget(target);
    });

    document.addEventListener("mouseout", (event) => {
      if (!activeTarget) return;
      const next = event.relatedTarget;
      if (next && activeTarget.contains(next)) return;
      activeTarget = null;
      cursor.classList.remove("locked");
      resetCorners();
    });

    window.addEventListener("scroll", () => {
      if (activeTarget) lockToTarget(activeTarget);
    }, { passive: true });

    resetCorners();
    frame();
  }

  function initFadeContent() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    fadeObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("fade-visible");
        fadeObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  }

  function registerFadeCards(root = document) {
    if (!fadeObserver) return;
    const selectors = [
      ".nav-card",
      ".card",
      ".feature-item",
      ".story-row",
      ".language-grid article",
      ".relation-overview article",
      ".relation-group",
      ".relation-notes",
      ".relation-list",
      ".dream-code"
    ].join(", ");

    root.querySelectorAll(selectors).forEach((target, index) => {
      if (target.classList.contains("fade-visible")) return;
      target.classList.add("fade-card");
      target.style.transitionDelay = `${Math.min(index, 6) * 70}ms`;
      fadeObserver.observe(target);
    });
  }

  window.addEventListener("scroll", updateTopbarState, { passive: true });

  initFadeContent();
  renderTabs();
  renderCards();
  renderContentSections();
  renderCanvasMap();
  registerFadeCards(document);
  initIntroCardNav();
  initTargetCursor();
  updateTopbarState();
})();
