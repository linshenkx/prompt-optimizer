import './styles.css'
import { inject } from '@vercel/analytics'

inject()

const STORAGE_KEY = 'prompt-optimizer-site-locale'
const THEME_STORAGE_KEY = 'prompt-optimizer-site-theme'
const SUPPORTED_LOCALES = ['zh-CN', 'en']
const THEME_MODES = ['system', 'dark', 'light']

const translations = {
  'zh-CN': {
    htmlLang: 'zh-CN',
    title: 'GlobalCloud XiaoC | XC wiki 提示词工程服务',
    description: '为飞书、XGD、GPC、Hermes、OpenClaw 等系统提供基于 wiki 体系的提示词生成、优化和嵌入式 MCP 服务。',
    brandAriaLabel: 'GlobalCloud XiaoC 官网首页',
    nav: {
      product: '优化器',
      garden: '提示词库',
      docs: '文档',
      github: 'GitHub',
      githubLabel: '开源仓库',
      themeAria: '切换主题模式',
      themeLabels: {
        system: '自动',
        dark: '深',
        light: '浅'
      },
      locale: 'EN',
      localeAria: '切换到英文',
      menuAria: '切换导航菜单'
    },
    hero: {
      eyebrow: 'XC · wiki 提示词工程服务',
      titleTop: '基于 wiki 体系',
      titleMid: '',
      titleBottom: '生成和优化提示词',
      lead: '为飞书、XGD、GPC、Hermes、OpenClaw 等系统提供可嵌入的提示词工程服务，也支持 Web 和桌面端直接使用。',
      primary: '打开产品',
      secondary: '查看文档',
      stats: [
        { value: 'wiki 体系', label: '知识来源' },
        { value: 'MCP 服务', label: '系统嵌入' },
        { value: 'Web / 桌面', label: '人工工作台' }
      ],
      visualLabel: '结果闭环',
      visualTitle: '优化、测试、评估在同一界面',
      screenshotBadge: '工作台预览',
      screenshotAlt: 'GlobalCloud XiaoC 工作台截图'
    },
    workflow: {
      kicker: '工作流',
      title: '从来源到复用，一条闭环',
      lead: '从 wiki 语境生成提示词，再用真实结果验证和沉淀，最后通过 MCP 或客户端进入业务流程。',
      steps: [
        {
          label: '来源',
          title: 'wiki 与业务语境',
          body: '知识、流程、角色、规范和系统上下文。'
        },
        {
          label: '核心',
          title: '生成与优化',
          body: '生成提示词、改写变量模板、处理上下文和图像提示词。'
        },
        {
          label: '判断',
          title: '测试与评估',
          body: '用输出、评估和对比决定是否适合真实流程。'
        },
        {
          label: '沉淀',
          title: '嵌入与复用',
          body: '通过 MCP 服务系统，或沉淀为客户端里的可复用资产。'
        }
      ]
    },
    scenario: {
      kicker: '工作区覆盖',
      title: '服务多类应用入口',
      lead: '既能嵌入业务系统，也能作为人工提示词工作台使用。',
      columns: {
        type: '结构类型',
        fit: '适用内容',
        capability: '关键能力'
      },
      cards: [
        {
          label: '业务系统',
          title: '飞书 / XGD / GPC',
          body: '把 wiki 语境转成可执行的任务提示词，嵌入协作和业务流程。',
          tags: ['飞书', 'XGD', 'GPC']
        },
        {
          label: '治理系统',
          title: 'Hermes / OpenClaw',
          body: '围绕项目状态、规则和证据链生成稳定的提示词工程能力。',
          tags: ['Hermes', 'OpenClaw', '治理']
        },
        {
          label: 'MCP 服务',
          title: '嵌入式提示词工程',
          body: '通过 MCP 暴露生成、优化和迭代工具，供外部系统调用。',
          tags: ['MCP', 'HTTP', '工具调用']
        },
        {
          label: '客户端',
          title: 'Web / 桌面工作台',
          body: '人工生成、优化、测试、评估和沉淀提示词资产。',
          tags: ['Web', 'Desktop', '资产复用']
        }
      ]
    },
    access: {
      kicker: '开放与入口',
      title: '开源可信，也能立刻开始',
      lead: '看清它的开放能力，再选最顺手的入口。',
      proof: {
        label: 'GitHub 仓库',
        title: 'linshenkx/prompt-optimizer',
        body: '同一套产品能力覆盖 Web、桌面版、自托管、Docker 和 MCP。',
        facts: ['AGPL-3.0', 'Web / Desktop / Extension', 'Docker / MCP'],
        primary: '查看 GitHub',
        secondary: '下载 Release'
      },
      entries: [
        {
          title: '在线产品',
          body: '直接进入工作台开始优化。',
          href: 'https://prompt.always200.com'
        },
        {
          title: '下载桌面版',
          body: '从 Releases 获取安装包。',
          href: 'https://github.com/linshenkx/prompt-optimizer/releases'
        },
        {
          title: 'Chrome 插件',
          body: '从 Chrome Web Store 安装入口。',
          href: 'https://chromewebstore.google.com/detail/prompt-optimizer/cakkkhboolfnadechdlgdcnjammejlna'
        },
        {
          title: 'Docker / MCP',
          body: '适合自托管和外部集成。',
          href: 'https://docs.always200.com/deployment/docker-basic/'
        }
      ]
    },
    footer: {
      title: 'GlobalCloud XiaoC',
      body: '基于 wiki 体系提供提示词工程服务。',
      product: '产品',
      docs: '文档',
      github: 'GitHub'
    }
  },
  en: {
    htmlLang: 'en',
    title: 'GlobalCloud XiaoC | XC wiki-driven prompt engineering service',
    description: 'Wiki-driven prompt generation, optimization, and embedded MCP services for Feishu, XGD, GPC, Hermes, OpenClaw, and other systems.',
    brandAriaLabel: 'GlobalCloud XiaoC website home',
    nav: {
      product: 'Optimizer',
      garden: 'Prompt Library',
      docs: 'Docs',
      github: 'GitHub',
      githubLabel: 'Open-source repository',
      themeAria: 'Switch theme mode',
      themeLabels: {
        system: 'Auto',
        dark: 'Dark',
        light: 'Light'
      },
      locale: '中文',
      localeAria: 'Switch to Chinese',
      menuAria: 'Toggle navigation menu'
    },
    hero: {
      eyebrow: 'XC · wiki-driven prompt engineering service',
      titleTop: 'Generate and optimize prompts',
      titleMid: '',
      titleBottom: 'from the wiki system',
      lead: 'Provide embedded prompt engineering services for Feishu, XGD, GPC, Hermes, OpenClaw, and other systems, while still supporting direct Web and desktop use.',
      primary: 'Open Product',
      secondary: 'Read Docs',
      stats: [
        { value: 'Wiki System', label: 'knowledge source' },
        { value: 'MCP Service', label: 'system embedding' },
        { value: 'Web / Desktop', label: 'human workspace' }
      ],
      visualLabel: 'Closed Loop',
      visualTitle: 'Optimize, test, and evaluate in one interface',
      screenshotBadge: 'Workspace preview',
      screenshotAlt: 'GlobalCloud XiaoC workspace screenshot'
    },
    workflow: {
      kicker: 'Workflow',
      title: 'From source to reuse in one loop',
      lead: 'Generate from wiki context, validate against real outputs, then deliver through MCP or client workflows.',
      steps: [
        {
          label: 'Source',
          title: 'Wiki and business context',
          body: 'Knowledge, workflows, roles, rules, and system context.'
        },
        {
          label: 'Core',
          title: 'Generation and optimization',
          body: 'Generate prompts, rewrite variable templates, and handle context or image prompts.'
        },
        {
          label: 'Judge',
          title: 'Testing and evaluation',
          body: 'Use outputs, evaluation, and comparison to decide whether prompts fit real workflows.'
        },
        {
          label: 'Keep',
          title: 'Embedding and reuse',
          body: 'Serve systems through MCP, or save reusable prompt assets in the client.'
        }
      ]
    },
    scenario: {
      kicker: 'Workspace coverage',
      title: 'Serve multiple application entry points',
      lead: 'XC works as both an embedded service and a human prompt engineering workspace.',
      columns: {
        type: 'Structure',
        fit: 'Best for',
        capability: 'Key capability'
      },
      cards: [
        {
          label: 'Business systems',
          title: 'Feishu / XGD / GPC',
          body: 'Turn wiki context into executable prompts for collaboration and business workflows.',
          tags: ['Feishu', 'XGD', 'GPC']
        },
        {
          label: 'Governance systems',
          title: 'Hermes / OpenClaw',
          body: 'Generate stable prompt engineering capabilities around project state, rules, and evidence chains.',
          tags: ['Hermes', 'OpenClaw', 'governance']
        },
        {
          label: 'MCP service',
          title: 'Embedded prompt engineering',
          body: 'Expose generation, optimization, and iteration tools for external systems.',
          tags: ['MCP', 'HTTP', 'tools']
        },
        {
          label: 'Clients',
          title: 'Web / desktop workspace',
          body: 'Generate, optimize, test, evaluate, and preserve prompt assets manually.',
          tags: ['Web', 'Desktop', 'reuse']
        }
      ]
    },
    access: {
      kicker: 'Open and access',
      title: 'Open-source credibility with immediate entry points',
      lead: 'Check the open surface first, then choose the path that fits you.',
      proof: {
        label: 'GitHub repository',
        title: 'linshenkx/prompt-optimizer',
        body: 'The same product surface spans web, desktop, self-hosting, Docker, and MCP.',
        facts: ['AGPL-3.0', 'Web / Desktop / Extension', 'Docker / MCP'],
        primary: 'View on GitHub',
        secondary: 'Download Releases'
      },
      entries: [
        {
          title: 'Web App',
          body: 'Open the workspace and start optimizing.',
          href: 'https://prompt.always200.com'
        },
        {
          title: 'Desktop Downloads',
          body: 'Get installers and archives from Releases.',
          href: 'https://github.com/linshenkx/prompt-optimizer/releases'
        },
        {
          title: 'Chrome Extension',
          body: 'Install it from the Chrome Web Store.',
          href: 'https://chromewebstore.google.com/detail/prompt-optimizer/cakkkhboolfnadechdlgdcnjammejlna'
        },
        {
          title: 'Docker / MCP',
          body: 'Best for self-hosting and integrations.',
          href: 'https://docs.always200.com/deployment/docker-basic/'
        }
      ]
    },
    footer: {
      title: 'GlobalCloud XiaoC',
      body: 'Wiki-driven prompt engineering for systems and clients.',
      product: 'Product',
      docs: 'Docs',
      github: 'GitHub'
    }
  }
}

function normalizeLocale(locale) {
  if (!locale) return 'zh-CN'
  if (locale.startsWith('zh')) return 'zh-CN'
  return 'en'
}

function getInitialLocale() {
  const storedLocale = window.localStorage.getItem(STORAGE_KEY)
  if (storedLocale && SUPPORTED_LOCALES.includes(storedLocale)) {
    return storedLocale
  }

  const browserLocale = normalizeLocale(navigator.language || navigator.languages?.[0] || 'zh-CN')
  return SUPPORTED_LOCALES.includes(browserLocale) ? browserLocale : 'zh-CN'
}

function normalizeThemeMode(themeMode) {
  if (THEME_MODES.includes(themeMode)) return themeMode
  return 'system'
}

function getInitialThemeMode() {
  return normalizeThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY) || 'system')
}

function resolveTheme(themeMode) {
  if (themeMode === 'light' || themeMode === 'dark') return themeMode
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getNextThemeMode(themeMode) {
  if (themeMode === 'system') return 'dark'
  if (themeMode === 'dark') return 'light'
  return 'system'
}

function renderLocaleButton(copy) {
  return `
    <button class="locale-switch" type="button" data-locale-toggle="true" aria-label="${copy.nav.localeAria}">
      ${copy.nav.locale}
    </button>
  `
}

function renderThemeButton(copy, themeMode) {
  return `
    <button class="theme-switch" type="button" data-theme-toggle="true" aria-label="${copy.nav.themeAria}" title="${copy.nav.themeAria}">
      <span class="theme-switch__icon" aria-hidden="true">${renderThemeIcon(themeMode)}</span>
      <span class="theme-switch__label">${copy.nav.themeLabels[themeMode]}</span>
    </button>
  `
}

function renderThemeIcon(themeMode) {
  if (themeMode === 'dark') {
    return `
      <svg viewBox="0 0 24 24" role="img" focusable="false">
        <path d="M21 12.79A9 9 0 0 1 11.21 3a7.5 7.5 0 1 0 9.79 9.79Z" fill="currentColor" />
      </svg>
    `
  }

  if (themeMode === 'light') {
    return `
      <svg viewBox="0 0 24 24" role="img" focusable="false">
        <circle cx="12" cy="12" r="4.2" fill="currentColor" />
        <path d="M12 1.5v3M12 19.5v3M4.57 4.57l2.12 2.12M17.31 17.31l2.12 2.12M1.5 12h3M19.5 12h3M4.57 19.43l2.12-2.12M17.31 6.69l2.12-2.12" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
      </svg>
    `
  }

  return `
    <svg viewBox="0 0 24 24" role="img" focusable="false">
      <rect x="4" y="5" width="16" height="11" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.8" />
      <path d="M8 19h8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
      <path d="M10 16.5h4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
    </svg>
  `
}

function renderGithubPill(copy) {
  return `
    <a class="github-pill" href="https://github.com/linshenkx/prompt-optimizer" target="_blank" rel="noopener" aria-label="${copy.nav.githubLabel}">
      <span class="github-pill__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="img" focusable="false">
          <path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.47c.52.1.7-.23.7-.5v-1.95c-2.86.62-3.46-1.21-3.46-1.21-.47-1.18-1.14-1.5-1.14-1.5-.93-.64.07-.63.07-.63 1.03.07 1.57 1.06 1.57 1.06.91 1.56 2.4 1.1 2.98.84.09-.66.36-1.1.65-1.35-2.28-.26-4.67-1.14-4.67-5.08 0-1.12.4-2.04 1.05-2.76-.1-.26-.46-1.31.1-2.73 0 0 .86-.28 2.82 1.05a9.8 9.8 0 0 1 5.13 0c1.96-1.33 2.82-1.05 2.82-1.05.56 1.42.2 2.47.1 2.73.66.72 1.05 1.64 1.05 2.76 0 3.95-2.39 4.82-4.67 5.08.37.32.7.95.7 1.92v2.84c0 .28.18.61.7.5A10.5 10.5 0 0 0 12 1.5Z" fill="currentColor"/>
        </svg>
      </span>
      <span class="github-pill__text">${copy.nav.github}</span>
      <img
        class="github-pill__badge"
        src="https://img.shields.io/github/stars/linshenkx/prompt-optimizer?style=flat&label=stars&color=2563eb&labelColor=f8fbff&logo=github&logoColor=0f172a"
        alt="GitHub stars"
      />
    </a>
  `
}

function renderNav(copy, themeMode) {
  return `
    <a href="https://prompt.always200.com" target="_blank" rel="noopener">${copy.nav.product}</a>
    <a href="https://garden.always200.com" target="_blank" rel="noopener">${copy.nav.garden}</a>
    <a href="https://docs.always200.com" target="_blank" rel="noopener">${copy.nav.docs}</a>
    ${renderGithubPill(copy)}
    ${renderThemeButton(copy, themeMode)}
    ${renderLocaleButton(copy)}
  `
}

function renderStats(stats) {
  return stats
    .map(
      (item) => `
        <article class="hero-stat">
          <strong>${item.value}</strong>
          <span>${item.label}</span>
        </article>
      `
    )
    .join('')
}

function renderPills(items, className = '') {
  return items.map((item) => `<span class="${className}">${item}</span>`).join('')
}

function renderApp(locale, themeMode) {
  const copy = translations[locale]
  const resolvedTheme = resolveTheme(themeMode)

  document.documentElement.lang = copy.htmlLang
  document.documentElement.dataset.locale = locale
  document.documentElement.dataset.theme = resolvedTheme
  document.documentElement.dataset.themeMode = themeMode
  document.title = copy.title

  const descriptionMeta = document.querySelector('meta[name="description"]')
  const ogDescriptionMeta = document.querySelector('meta[property="og:description"]')
  const ogTitleMeta = document.querySelector('meta[property="og:title"]')
  const themeColorMeta = document.querySelector('meta[name="theme-color"]')

  if (descriptionMeta) descriptionMeta.setAttribute('content', copy.description)
  if (ogDescriptionMeta) ogDescriptionMeta.setAttribute('content', copy.description)
  if (ogTitleMeta) ogTitleMeta.setAttribute('content', copy.title)
  if (themeColorMeta) themeColorMeta.setAttribute('content', resolvedTheme === 'dark' ? '#081120' : '#f8fbfe')

  document.querySelector('#app').innerHTML = `
    <div class="site-shell">
      <div class="site-background" aria-hidden="true">
        <div class="site-glow site-glow--left"></div>
        <div class="site-glow site-glow--right"></div>
        <div class="site-grid"></div>
      </div>

      <header class="site-header">
        <a class="site-brand" href="/" aria-label="${copy.brandAriaLabel}">
          <img src="/images/logo.png" alt="" class="site-brand__logo" />
          <span class="site-brand__text">GlobalCloud XiaoC</span>
        </a>
        <button class="site-menu-button" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="${copy.nav.menuAria}">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <nav class="site-nav" id="site-nav" aria-label="Primary">
          ${renderNav(copy, themeMode)}
        </nav>
      </header>

      <main>
        <section class="hero">
          <div class="hero-copy" data-reveal style="--reveal-delay: 20ms">
            <div class="eyebrow">
              <img src="/images/logo.png" alt="" />
              <span>${copy.hero.eyebrow}</span>
            </div>
            <h1 class="hero-title">
              <span class="hero-title__line hero-title__line--top">${copy.hero.titleTop}</span>
              ${copy.hero.titleMid ? `<span class="hero-title__line hero-title__line--mid">${copy.hero.titleMid}</span>` : ''}
              <span class="hero-title__line hero-title__line--bottom">${copy.hero.titleBottom}</span>
            </h1>
            <p class="hero-lead">${copy.hero.lead}</p>
            <div class="hero-actions">
              <a class="button button--primary" href="https://prompt.always200.com" target="_blank" rel="noopener">${copy.hero.primary}</a>
              <a class="button" href="https://docs.always200.com" target="_blank" rel="noopener">${copy.hero.secondary}</a>
            </div>
            <div class="hero-proof">
              ${renderStats(copy.hero.stats)}
            </div>
          </div>

          <div class="hero-visual" data-reveal style="--reveal-delay: 120ms">
            <div class="hero-visual__meta">
              <span class="signal-label">${copy.hero.visualLabel}</span>
              <p>${copy.hero.visualTitle}</p>
            </div>
            <div class="hero-shot">
              <div class="hero-shot__badge">${copy.hero.screenshotBadge}</div>
              <img src="/images/demo/knowledge-graph-extractor.png" alt="${copy.hero.screenshotAlt}" />
            </div>
          </div>
        </section>

        <section class="section section--workflow" data-reveal>
          <div class="section-head section-head--center workflow-head">
            <p class="section-kicker">${copy.workflow.kicker}</p>
            <h2>${copy.workflow.title}</h2>
            <p class="section-lead">${copy.workflow.lead}</p>
          </div>
          <div class="workflow-line">
            ${copy.workflow.steps
              .map(
                (step, index) => `
                  <article class="workflow-node workflow-node--${index + 1}" data-reveal style="--reveal-delay: ${100 + index * 90}ms">
                    <div class="workflow-node__marker">
                      <span class="workflow-index">0${index + 1}</span>
                    </div>
                    <div class="workflow-node__body">
                      <span class="workflow-card__label">${step.label}</span>
                      <h3>${step.title}</h3>
                      <p>${step.body}</p>
                    </div>
                  </article>
                `
              )
              .join('')}
          </div>
        </section>

        <section class="section section--scenario">
          <div class="scenario-layout">
            <div class="section-head scenario-head" data-reveal>
              <p class="section-kicker">${copy.scenario.kicker}</p>
              <h2>${copy.scenario.title}</h2>
              <p class="section-lead">${copy.scenario.lead}</p>
            </div>
            <div class="scenario-matrix" data-reveal style="--reveal-delay: 100ms">
              <div class="scenario-matrix__head">
                <span>${copy.scenario.columns.type}</span>
                <span>${copy.scenario.columns.fit}</span>
                <span>${copy.scenario.columns.capability}</span>
              </div>
              ${copy.scenario.cards
                .map(
                  (card, index) => `
                    <article class="scenario-row scenario-row--${index + 1}" data-reveal style="--reveal-delay: ${120 + index * 80}ms">
                      <div class="scenario-row__meta">
                        <span class="scenario-row__index">0${index + 1}</span>
                        <span class="scenario-card__label">${card.label}</span>
                      </div>
                      <div class="scenario-row__body">
                        <h3>${card.title}</h3>
                        <p>${card.body}</p>
                      </div>
                      <div class="scenario-row__tags">
                        ${renderPills(card.tags)}
                      </div>
                    </article>
                  `
                )
                .join('')}
            </div>
          </div>
        </section>

        <section class="section section--access">
          <div class="section-head" data-reveal>
            <p class="section-kicker">${copy.access.kicker}</p>
            <h2>${copy.access.title}</h2>
            <p class="section-lead">${copy.access.lead}</p>
          </div>
          <article class="proof-strip" data-reveal style="--reveal-delay: 80ms">
            <div class="proof-strip__main">
              <div class="proof-strip__top">
                <div class="proof-strip__title">
                  <span class="proof-strip__label">${copy.access.proof.label}</span>
                  <strong>${copy.access.proof.title}</strong>
                </div>
                <img
                  class="proof-strip__stars"
                  src="https://img.shields.io/github/stars/linshenkx/prompt-optimizer?style=for-the-badge&label=stars&color=2d6cff&labelColor=0b1633"
                  alt="GitHub stars"
                />
              </div>
              <p>${copy.access.proof.body}</p>
              <div class="proof-strip__facts">
                ${renderPills(copy.access.proof.facts)}
              </div>
            </div>
            <div class="proof-strip__actions">
              <a class="button button--primary" href="https://github.com/linshenkx/prompt-optimizer" target="_blank" rel="noopener">${copy.access.proof.primary}</a>
              <a class="button button--light" href="https://github.com/linshenkx/prompt-optimizer/releases" target="_blank" rel="noopener">${copy.access.proof.secondary}</a>
            </div>
          </article>
          <div class="entry-shelf">
            ${copy.access.entries
              .map(
                (entry, index) => `
                  <a class="entry-card entry-card--${index + 1}" data-reveal style="--reveal-delay: ${120 + index * 70}ms" href="${entry.href}" target="_blank" rel="noopener">
                    <strong>${entry.title}</strong>
                    <span>${entry.body}</span>
                  </a>
                `
              )
              .join('')}
          </div>
        </section>
      </main>

      <footer class="site-footer">
        <div class="site-footer__copy">
          <strong>${copy.footer.title}</strong>
          <p>${copy.footer.body}</p>
        </div>
        <div class="site-footer__links">
          <a href="https://prompt.always200.com" target="_blank" rel="noopener">${copy.footer.product}</a>
          <a href="https://docs.always200.com" target="_blank" rel="noopener">${copy.footer.docs}</a>
          <a href="https://github.com/linshenkx/prompt-optimizer" target="_blank" rel="noopener">${copy.footer.github}</a>
          ${renderThemeButton(copy, themeMode)}
          ${renderLocaleButton(copy)}
        </div>
      </footer>
    </div>
  `

  bindInteractions(locale, themeMode)
  bindRevealAnimations()
  bindMotionEffects()
}

function bindInteractions(locale, themeMode) {
  const menuButton = document.querySelector('.site-menu-button')
  const nav = document.querySelector('.site-nav')

  if (menuButton && nav) {
    menuButton.addEventListener('click', () => {
      const expanded = menuButton.getAttribute('aria-expanded') === 'true'
      menuButton.setAttribute('aria-expanded', String(!expanded))
      nav.classList.toggle('site-nav--open', !expanded)
    })
  }

  document.querySelectorAll('[data-locale-toggle="true"]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextLocale = locale === 'zh-CN' ? 'en' : 'zh-CN'
      window.localStorage.setItem(STORAGE_KEY, nextLocale)
      currentLocale = nextLocale
      renderApp(currentLocale, currentThemeMode)
    })
  })

  document.querySelectorAll('[data-theme-toggle="true"]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextThemeMode = getNextThemeMode(themeMode)
      window.localStorage.setItem(THEME_STORAGE_KEY, nextThemeMode)
      currentThemeMode = nextThemeMode
      renderApp(currentLocale, currentThemeMode)
    })
  })
}

function bindRevealAnimations() {
  const revealTargets = document.querySelectorAll('[data-reveal]')

  if (!revealTargets.length) return

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (prefersReducedMotion) {
    revealTargets.forEach((node) => node.classList.add('is-visible'))
    return
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      revealTargets.forEach((node) => node.classList.add('is-visible'))
    })
  })
}

function bindMotionEffects() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const prefersFinePointer = window.matchMedia('(pointer: fine)').matches

  if (prefersReducedMotion || !prefersFinePointer) return

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

  const bindPointerSurface = (selector, prefix, maxTilt = 6, maxShift = 16) => {
    const element = document.querySelector(selector)
    if (!element) return

    const reset = () => {
      element.style.setProperty(`--${prefix}-pointer-x`, '50%')
      element.style.setProperty(`--${prefix}-pointer-y`, '50%')
      element.style.setProperty(`--${prefix}-tilt-x`, '0deg')
      element.style.setProperty(`--${prefix}-tilt-y`, '0deg')
      element.style.setProperty(`--${prefix}-shift-x`, '0px')
      element.style.setProperty(`--${prefix}-shift-y`, '0px')
    }

    const update = (event) => {
      const rect = element.getBoundingClientRect()
      const px = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100)
      const py = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)
      const nx = clamp((px - 50) / 50, -1, 1)
      const ny = clamp((py - 50) / 50, -1, 1)

      element.style.setProperty(`--${prefix}-pointer-x`, `${px.toFixed(2)}%`)
      element.style.setProperty(`--${prefix}-pointer-y`, `${py.toFixed(2)}%`)
      element.style.setProperty(`--${prefix}-tilt-x`, `${(-ny * maxTilt).toFixed(2)}deg`)
      element.style.setProperty(`--${prefix}-tilt-y`, `${(nx * maxTilt).toFixed(2)}deg`)
      element.style.setProperty(`--${prefix}-shift-x`, `${(nx * maxShift).toFixed(2)}px`)
      element.style.setProperty(`--${prefix}-shift-y`, `${(ny * maxShift).toFixed(2)}px`)
    }

    reset()
    element.addEventListener('pointermove', update)
    element.addEventListener('pointerleave', reset)
  }

  bindPointerSurface('.hero', 'hero', 5.5, 18)
  bindPointerSurface('.proof-strip', 'proof', 3.5, 10)
}

let currentLocale = getInitialLocale()
let currentThemeMode = getInitialThemeMode()

const colorSchemeMedia = window.matchMedia('(prefers-color-scheme: dark)')

if (typeof colorSchemeMedia.addEventListener === 'function') {
  colorSchemeMedia.addEventListener('change', () => {
    if (currentThemeMode === 'system') {
      renderApp(currentLocale, currentThemeMode)
    }
  })
}

renderApp(currentLocale, currentThemeMode)
