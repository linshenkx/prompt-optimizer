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
    title: 'Prompt Optimizer | 提示词优化，应该基于真实结果',
    description: '接入自己的模型，优化提示词、对照真实输出，并在竞技场比较模型与参数。支持文本、变量、上下文和图像工作区。',
    brandAriaLabel: 'Prompt Optimizer 官网首页',
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
      eyebrow: '开源提示词工作台',
      titleTop: '基于真实结果',
      titleMid: '',
      titleBottom: '优化提示词',
      lead: '接入自己的模型，改写提示词，对照真实输出。也能在竞技场直接比较模型与参数。',
      primary: '打开产品',
      secondary: '查看文档',
      stats: [
        { value: '真实测试', label: '先看结果' },
        { value: '竞技场', label: '并排比较' },
        { value: '智能收藏', label: '保存与复用' }
      ],
      visualLabel: '结果闭环',
      visualTitle: '优化、测试、评估在同一界面',
      screenshotAlt: '红队审稿：原始提示词与结构化审查报告的同模型对比',
      screenshot: 'system-workspace-zh-CN.jpg'
    },
    workflow: {
      kicker: '工作流',
      title: '从来源到复用，一条闭环',
      lead: '少解释，多验证。提示词进入优化器后，用真实结果决定下一步。',
      steps: [
        {
          label: '来源',
          title: '任意提示词',
          body: '手写、模板、本地导入或提示词库。'
        },
        {
          label: '核心',
          title: '优化器',
          body: '改写、变量、上下文和图像提示词。'
        },
        {
          label: '判断',
          title: '真实测试',
          body: '用输出、评估和对比决定是否有效。'
        },
        {
          label: '沉淀',
          title: '智能收藏',
          body: '保存版本、示例、媒体和来源信息。'
        }
      ]
    },
    scenario: {
      kicker: '工作区覆盖',
      title: '覆盖多类提示词',
      lead: '从单条任务到完整上下文，选择适合输入结构的工作区；已有提示词可直接进入竞技场。',
      columns: {
        type: '结构类型',
        fit: '适用内容',
        capability: '关键能力'
      },
      cards: [
        {
          label: '单条提示词',
          title: 'system / user 单提示词',
          body: '适合优化角色、规则与输出格式。',
          tags: ['system', 'user', '聚焦分析']
        },
        {
          label: '变量模板',
          title: '变量模板',
          body: '把主题、语气和角色收进模板后再验证。',
          tags: ['占位变量', '真实输入', '模板复用']
        },
        {
          label: '上下文链路',
          title: '多消息上下文',
          body: '当 system、user 与上下文共同影响结果时仍可分析。',
          tags: ['system + user', '上下文', '多消息']
        },
        {
          label: '图像生成',
          title: '文生图 / 图生图 / 多图',
          body: '支持文生图、图生图和多图输入，可改写提示词、比较版本，并预览和下载生成结果。',
          tags: ['T2I', 'I2I', '多图生图', '风格迁移']
        }
      ]
    },
    examples: {
      title: '用同一道题，看清差异',
      lead: '固定输入，再比较模型、提示词版本或参数。一次只改变一个因素，更容易判断效果。',
      items: [
        { image: 'arena-comparison-zh-CN.jpg', title: '竞技场：同题比较三个模型', body: '让 GPT-6.2 Astra、GPT-6.2 Sol 和 DeepSeek Flash 绘制同一场景，并排查看各自的构图与细节。', link: 'https://docs.always200.com/advanced/arena/', action: '了解竞技场' }
      ]
    },
    access: {
      kicker: '开放与入口',
      title: '开源可信，也能立刻开始',
      lead: '自备可用的 API Key 或本地模型。应用配置、历史与收藏默认保存在当前使用环境；调用时，相关输入会发送给你配置的模型服务，远程备份会发送到你配置的存储。',
      proof: {
        label: 'GitHub 仓库',
        title: 'linshenkx/prompt-optimizer',
        body: '通过 Web、桌面版、扩展或 Docker 使用工作台；MCP 为外部工具提供提示词优化能力。',
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
      title: 'Prompt Optimizer',
      body: '让提示词优化回到真实结果。',
      product: '产品',
      docs: '文档',
      github: 'GitHub'
    }
  },
  en: {
    htmlLang: 'en',
    title: 'Prompt Optimizer | Prompt optimization should follow real outputs',
    description: 'Connect your own models, improve prompts, compare real outputs, and test models or parameters in Arena. Text, variables, context, and image workspaces.',
    brandAriaLabel: 'Prompt Optimizer website home',
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
      eyebrow: 'Open-source prompt workspace',
      titleTop: 'Real outputs first',
      titleMid: '',
      titleBottom: 'Prompt optimization',
      lead: 'Connect your models, refine prompts, and compare real outputs. Use Arena to test models and parameter settings side by side.',
      primary: 'Open Product',
      secondary: 'Read Docs',
      stats: [
        { value: 'Real Tests', label: 'see outputs first' },
        { value: 'Arena', label: 'side-by-side tests' },
        { value: 'Smart Favorites', label: 'reusable assets' }
      ],
      visualLabel: 'Closed Loop',
      visualTitle: 'Optimize, test, and evaluate in one interface',
      screenshotAlt: 'Red-team review: original and revised prompts tested on the same model',
      screenshot: 'system-workspace-en.jpg'
    },
    workflow: {
      kicker: 'Workflow',
      title: 'From source to reuse in one loop',
      lead: 'Less explanation, more validation. Once a prompt enters Optimizer, real outputs decide what changes.',
      steps: [
        {
          label: 'Source',
          title: 'Any prompt',
          body: 'Drafts, templates, local imports, or Prompt Garden.'
        },
        {
          label: 'Core',
          title: 'Optimizer',
          body: 'Rewrite text, variables, context, and image prompts.'
        },
        {
          label: 'Judge',
          title: 'Real tests',
          body: 'Use outputs, evaluation, and comparison to decide.'
        },
        {
          label: 'Keep',
          title: 'Smart Favorites',
          body: 'Save versions, examples, media, and source details.'
        }
      ]
    },
    scenario: {
      kicker: 'Workspace coverage',
      title: 'Handle different prompt structures',
      lead: 'Choose a workspace for your input structure, or take an existing prompt straight to Arena.',
      columns: {
        type: 'Structure',
        fit: 'Best for',
        capability: 'Key capability'
      },
      cards: [
        {
          label: 'Single prompt',
          title: 'System / user single prompt',
          body: 'Best for roles, rules, and output instructions.',
          tags: ['system', 'user', 'focused analysis']
        },
        {
          label: 'Variables',
          title: 'Variable templates',
          body: 'Validate reusable templates with real values.',
          tags: ['variables', 'real input', 'reuse']
        },
        {
          label: 'Context chain',
          title: 'Multi-message context',
          body: 'Useful when system, user, and context all affect the result.',
          tags: ['system + user', 'context', 'multi-message']
        },
        {
          label: 'Image generation',
          title: 'Text-to-image / Image-to-image / Multi-image',
          body: 'Write and revise prompts for text-to-image, image-to-image, and multi-image workflows, then preview and download results.',
          tags: ['T2I', 'I2I', 'multi-image', 'style transfer']
        }
      ]
    },
    examples: {
      title: 'One task. Clearer comparisons.',
      lead: 'Keep input fixed, then compare models, prompt versions, or settings. Change one factor at a time to understand the result.',
      items: [
        { image: 'arena-comparison-en.jpg', title: 'Arena: one task, three models', body: 'Ask GPT-6.2 Astra, GPT-6.2 Sol, and DeepSeek Flash to draw the same scene, then compare their composition and detail.', link: 'https://docs.always200.com/en/advanced/arena/', action: 'Explore Arena' }
      ]
    },
    access: {
      kicker: 'Open and access',
      title: 'Open-source credibility with immediate entry points',
      lead: 'Bring an API key or local model. Configuration, history, and favorites are stored in your current environment by default. Calls send relevant input to your configured model service; remote backups go to your configured storage.',
      proof: {
        label: 'GitHub repository',
        title: 'linshenkx/prompt-optimizer',
        body: 'Use the workspace on the web, desktop, extension, or Docker. MCP exposes prompt optimization tools for external clients.',
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
      title: 'Prompt Optimizer',
      body: 'Bring prompt optimization back to real outputs.',
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
          <span class="site-brand__text">Prompt Optimizer</span>
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
              <a href="/images/product/2026-11/${copy.hero.screenshot}" target="_blank" rel="noopener" aria-label="${copy.hero.screenshotAlt}">
                <img src="/images/product/2026-11/${copy.hero.screenshot}" alt="${copy.hero.screenshotAlt}" width="2047" height="1018" fetchpriority="high" />
              </a>
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

        <section class="section section--examples">
          <div class="section-head" data-reveal>
            <h2>${copy.examples.title}</h2>
            <p class="section-lead">${copy.examples.lead}</p>
          </div>
          <div class="workspace-examples">
            ${copy.examples.items.map((item) => `
              <figure class="workspace-example" data-reveal>
                <a class="workspace-example__image" href="/images/product/2026-11/${item.image}" target="_blank" rel="noopener" aria-label="${item.title}">
                  <img src="/images/product/2026-11/${item.image}" alt="${item.body}" width="2047" height="1018" loading="lazy" />
                </a>
                <figcaption>
                  <h3>${item.title}</h3>
                  <p>${item.body}</p>
                  <a href="${item.link}" target="_blank" rel="noopener">${item.action} <span aria-hidden="true">↗</span></a>
                </figcaption>
              </figure>
            `).join('')}
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
