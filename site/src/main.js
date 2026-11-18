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
    title: '提示词优化器 | Prompt Optimizer',
    description: '开源提示词工具。用自己的模型改写给 AI 的指令，并排比较改写前后的回答，保存满意的版本。',
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
      title: '提示词优化器',
      lead: '贴入你准备发给 AI 的指令，改写后用同一个模型测试两版，看看哪份回答更符合你的要求。',
      primary: '打开优化器',
      secondary: '快速开始',
      guide: 'https://docs.always200.com/user/quick-start/',
      setupNote: '首次使用需配置 API Key 或连接已运行的本地模型。',
      visualTitle: '左侧改写提示词，右侧对比两版回答',
      screenshotLabel: '点击放大工作区截图',
      screenshotAlt: '提示词优化器工作区截图，右侧并排展示改写前后的回答',
      screenshot: 'system-workspace-zh-CN.jpg'
    },
    imagePreview: {
      title: '截图预览',
      hint: '点击放大',
      actualSize: '查看原尺寸',
      fit: '适应窗口',
      close: '关闭预览'
    },
    workflow: {
      title: '怎样优化一条提示词',
      steps: [
        {
          title: '填入提示词',
          body: '粘贴你准备发给 AI 的指令，也可以从模板、文件或提示词库导入。'
        },
        {
          title: '改写任务要求',
          body: '用你选的模型补清楚任务目标、约束和输出格式。'
        },
        {
          title: '比较两版回答',
          body: '用同一个模型测试两版提示词，看改写是否解决了原来的问题。'
        },
        {
          title: '保存并复用',
          body: '把满意的提示词和测试示例存入收藏，下次接着用。'
        }
      ]
    },
    workspaces: {
      title: '按任务选择工作区',
      items: [
        {
          title: '单条提示词',
          body: '改写一条系统或用户提示词，明确角色、规则和输出格式。'
        },
        {
          title: '变量模板',
          body: '同一套提示词需要反复替换输入时，用真实数据测试模板。'
        },
        {
          title: '多消息上下文',
          body: '把系统指令、用户消息和对话历史放在一起，测试它们如何影响回答。'
        },
        {
          title: '图像提示词',
          body: '改写并测试文生图、图生图和多图提示词，对比生成结果。'
        }
      ]
    },
    arena: {
      title: '在竞技场比较模型和参数',
      lead: '用同一道题比较不同模型，或比较同一模型在不同设置（例如思考强度）下的回答。',
      screenshot: 'arena-comparison-zh-CN.jpg',
      screenshotLabel: '点击放大竞技场截图',
      screenshotAlt: '竞技场并排展示三个模型绘制的机械鲸鱼场景',
      caption: '同一道 HTML/SVG 绘图题，结果从左到右：GPT-6.2 Astra、GPT-6.2 Sol、DeepSeek Flash。',
      guide: 'https://docs.always200.com/advanced/arena/',
      action: '了解竞技场'
    },
    access: {
      title: '选择使用方式',
      repository: 'GitHub 开源仓库',
      mcp: 'MCP 集成',
      mcpGuide: 'https://docs.always200.com/user/mcp-server/',
      dataNote: '配置、历史和收藏默认保存在当前使用环境。相关输入会发给你配置的模型服务，远程备份会发到你配置的存储。',
      entries: [
        {
          title: '在线使用',
          body: '在浏览器打开工作区。',
          href: 'https://prompt.always200.com'
        },
        {
          title: '下载桌面版',
          body: '从 Releases 获取安装包。',
          href: 'https://github.com/linshenkx/prompt-optimizer/releases'
        },
        {
          title: 'Chrome 插件',
          body: '从 Chrome 网上应用店安装。',
          href: 'https://chromewebstore.google.com/detail/prompt-optimizer/cakkkhboolfnadechdlgdcnjammejlna'
        },
        {
          title: 'Docker 部署',
          body: '运行自己的实例。',
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
    title: 'Prompt Optimizer | Rewrite and test AI prompts',
    description: 'An open-source tool to rewrite prompts with your own models, compare actual responses, and save prompts for reuse.',
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
      title: 'Prompt Optimizer',
      lead: 'Paste a prompt, rewrite it, and test both versions with the same model. See which answer fits your task better.',
      primary: 'Open Optimizer',
      secondary: 'Quick start',
      guide: 'https://docs.always200.com/en/user/quick-start/',
      setupNote: 'To get started, add an API key or connect to a running local model.',
      visualTitle: 'Edit on the left, compare answers on the right',
      screenshotLabel: 'Click to enlarge the workspace screenshot',
      screenshotAlt: 'Prompt Optimizer workspace with answers before and after rewriting shown side by side',
      screenshot: 'system-workspace-en.jpg'
    },
    imagePreview: {
      title: 'Screenshot preview',
      hint: 'Click to enlarge',
      actualSize: 'View actual size',
      fit: 'Fit to window',
      close: 'Close preview'
    },
    workflow: {
      title: 'How to improve a prompt',
      steps: [
        {
          title: 'Start with a prompt',
          body: 'Paste your own prompt or import one from a template, file, or Prompt Garden.'
        },
        {
          title: 'Clarify the instructions',
          body: 'Use a model you choose to make the task, constraints, and output format more specific.'
        },
        {
          title: 'Compare responses',
          body: 'Test both prompts with the same model to see whether the rewrite helped.'
        },
        {
          title: 'Save the version you prefer',
          body: 'Keep the prompt and its test examples in Favorites for next time.'
        }
      ]
    },
    workspaces: {
      title: 'Choose a workspace',
      items: [
        {
          title: 'Single prompt',
          body: 'Rewrite a system or user prompt to clarify its role, rules, and output format.'
        },
        {
          title: 'Variable templates',
          body: 'Test a reusable prompt with the real values you plan to swap in.'
        },
        {
          title: 'Multi-message context',
          body: 'Test how system instructions, user messages, and conversation history affect the answer together.'
        },
        {
          title: 'Image prompts',
          body: 'Rewrite prompts and compare results for text-to-image, image-to-image, and multi-image tasks.'
        }
      ]
    },
    arena: {
      title: 'Compare models and settings in Arena',
      lead: 'Give different models the same task, or compare one model at different settings, such as reasoning effort.',
      screenshot: 'arena-comparison-en.jpg',
      screenshotLabel: 'Click to enlarge the Arena screenshot',
      screenshotAlt: 'Arena showing three models’ drawings of a mechanical whale side by side',
      caption: 'Same HTML/SVG drawing task. From left to right: GPT-6.2 Astra, GPT-6.2 Sol, and DeepSeek Flash.',
      guide: 'https://docs.always200.com/en/advanced/arena/',
      action: 'Explore Arena'
    },
    access: {
      title: 'Ways to use Prompt Optimizer',
      repository: 'GitHub repository',
      mcp: 'MCP integration',
      mcpGuide: 'https://docs.always200.com/en/user/mcp-server/',
      dataNote: 'Settings, history, and favorites stay in your current environment by default. Model requests and remote backups go to the model service and storage you configure.',
      entries: [
        {
          title: 'Web app',
          body: 'Open the workspace in your browser.',
          href: 'https://prompt.always200.com'
        },
        {
          title: 'Desktop downloads',
          body: 'Get installers and archives from Releases.',
          href: 'https://github.com/linshenkx/prompt-optimizer/releases'
        },
        {
          title: 'Chrome extension',
          body: 'Install it from the Chrome Web Store.',
          href: 'https://chromewebstore.google.com/detail/prompt-optimizer/cakkkhboolfnadechdlgdcnjammejlna'
        },
        {
          title: 'Docker deployment',
          body: 'Host your own instance.',
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

function renderApp(locale, themeMode) {
  const copy = translations[locale]
  const resolvedTheme = resolveTheme(themeMode)
  const menuExpanded = document.querySelector('.site-menu-button')?.getAttribute('aria-expanded') ?? 'false'
  const focusedToggle = document.activeElement?.closest('.locale-switch, .theme-switch')
  const focusedRegion = focusedToggle?.closest('header, footer')?.localName

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
        <button class="site-menu-button" type="button" aria-expanded="${menuExpanded}" aria-controls="site-nav" aria-label="${copy.nav.menuAria}">
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
          <div class="hero-copy">
            <h1 class="hero-title">${copy.hero.title}</h1>
            <p class="hero-lead">${copy.hero.lead}</p>
            <div class="hero-actions">
              <a class="button button--primary" href="https://prompt.always200.com" target="_blank" rel="noopener">${copy.hero.primary}</a>
              <a class="button" href="${copy.hero.guide}" target="_blank" rel="noopener" aria-describedby="hero-setup">${copy.hero.secondary}</a>
            </div>
            <p class="hero-setup" id="hero-setup">${copy.hero.setupNote}</p>
          </div>

          <a class="hero-visual" href="/images/product/2026-11/${copy.hero.screenshot}" data-image-preview aria-haspopup="dialog" aria-controls="image-preview" aria-label="${copy.hero.screenshotLabel}" aria-describedby="hero-screenshot-caption">
            <p class="hero-visual__meta" id="hero-screenshot-caption">
              ${copy.hero.visualTitle}<span class="screenshot-hint" aria-hidden="true">${copy.imagePreview.hint}</span>
            </p>
            <div class="hero-shot">
              <img src="/images/product/2026-11/${copy.hero.screenshot}" alt="${copy.hero.screenshotAlt}" width="2047" height="1018" fetchpriority="high" />
            </div>
          </a>
        </section>

        <section class="section">
          <div class="section-head">
            <h2>${copy.workflow.title}</h2>
          </div>
          <div class="workflow-line">
            ${copy.workflow.steps
              .map(
                (step, index) => `
                  <article class="workflow-node workflow-node--${index + 1}">
                    <div class="workflow-node__marker">
                      <span class="workflow-index">0${index + 1}</span>
                    </div>
                    <div class="workflow-node__body">
                      <h3>${step.title}</h3>
                      <p>${step.body}</p>
                    </div>
                  </article>
                `
              )
              .join('')}
          </div>
        </section>

        <section class="section" id="arena">
          <div class="section-head">
            <h2>${copy.arena.title}</h2>
            <p class="section-lead">${copy.arena.lead}</p>
          </div>
          <figure class="arena-example">
            <a class="arena-example__image" href="/images/product/2026-11/${copy.arena.screenshot}" data-image-preview aria-haspopup="dialog" aria-controls="image-preview" aria-label="${copy.arena.screenshotLabel}" aria-describedby="arena-screenshot-caption">
              <img src="/images/product/2026-11/${copy.arena.screenshot}" alt="${copy.arena.screenshotAlt}" width="2047" height="1018" loading="lazy" />
            </a>
            <figcaption class="arena-example__caption">
              <p id="arena-screenshot-caption">
                ${copy.arena.caption}<span class="screenshot-hint" aria-hidden="true">${copy.imagePreview.hint}</span>
              </p>
              <a class="section-link" href="${copy.arena.guide}" target="_blank" rel="noopener">${copy.arena.action}</a>
            </figcaption>
          </figure>
        </section>

        <section class="section" id="workspaces">
          <div class="section-head">
            <h2>${copy.workspaces.title}</h2>
          </div>
          <div class="workspace-list">
            ${copy.workspaces.items.map((item) => `
              <article>
                <h3>${item.title}</h3>
                <p>${item.body}</p>
              </article>
            `).join('')}
          </div>
        </section>

        <section class="section" id="get-started">
          <div class="section-head">
            <h2>${copy.access.title}</h2>
          </div>
          <div class="entry-list">
            ${copy.access.entries.map((entry) => `
              <a class="entry-link" href="${entry.href}" target="_blank" rel="noopener">
                <strong>${entry.title}</strong>
                <span>${entry.body}</span>
              </a>
            `).join('')}
          </div>
          <div class="project-details">
            <div class="project-details__links">
              <a class="section-link" href="https://github.com/linshenkx/prompt-optimizer" target="_blank" rel="noopener">${copy.access.repository}</a>
              <span>AGPL-3.0</span>
              <a class="section-link" href="${copy.access.mcpGuide}" target="_blank" rel="noopener">${copy.access.mcp}</a>
            </div>
            <p>${copy.access.dataNote}</p>
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

    <dialog class="image-preview" id="image-preview" aria-label="${copy.imagePreview.title}">
      <div class="image-preview__toolbar">
        <button class="image-preview__control" type="button" data-preview-zoom>${copy.imagePreview.actualSize}</button>
        <form method="dialog">
          <button class="image-preview__control image-preview__close" type="submit" aria-label="${copy.imagePreview.close}" title="${copy.imagePreview.close}" autofocus>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </form>
      </div>
      <div class="image-preview__viewport" tabindex="-1">
        <img alt="" draggable="false" />
      </div>
    </dialog>
  `

  bindInteractions(locale, themeMode)
  bindImagePreview(copy.imagePreview)
  bindMotionEffects()

  if (focusedRegion) {
    const toggleClass = focusedToggle.classList.contains('locale-switch') ? 'locale-switch' : 'theme-switch'
    document.querySelector(`${focusedRegion} .${toggleClass}`)?.focus({ preventScroll: true })
  }
}

function bindInteractions(locale, themeMode) {
  const menuButton = document.querySelector('.site-menu-button')
  menuButton.addEventListener('click', () => {
    const expanded = menuButton.getAttribute('aria-expanded') === 'true'
    menuButton.setAttribute('aria-expanded', String(!expanded))
  })

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

function bindImagePreview(copy) {
  const dialog = document.getElementById('image-preview')
  if (typeof dialog.showModal !== 'function') return

  const viewport = dialog.querySelector('.image-preview__viewport')
  const image = viewport.querySelector('img')
  const zoom = dialog.querySelector('[data-preview-zoom]')
  const page = document.documentElement
  let origin

  const setActualSize = (actual) => {
    dialog.toggleAttribute('data-actual-size', actual)
    zoom.textContent = actual ? copy.fit : copy.actualSize
    viewport.tabIndex = actual ? 0 : -1
    viewport.scrollTo(0, 0)
  }

  document.querySelectorAll('[data-image-preview]').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return

      event.preventDefault()
      origin = { trigger, x: window.scrollX, y: window.scrollY }
      const scrollbarWidth = window.innerWidth - page.getBoundingClientRect().width
      page.style.setProperty('--preview-scrollbar-width', `${scrollbarWidth}px`)
      image.alt = trigger.querySelector('img').alt
      image.src = trigger.href
      setActualSize(false)
      dialog.showModal()
    })
  })

  zoom.addEventListener('click', () => setActualSize(!dialog.hasAttribute('data-actual-size')))
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close()
  })
  dialog.addEventListener('close', () => {
    page.style.removeProperty('--preview-scrollbar-width')
    if (!origin) return

    origin.trigger.focus({ preventScroll: true })
    if (window.scrollX !== origin.x || window.scrollY !== origin.y) {
      window.scrollTo({ left: origin.x, top: origin.y, behavior: 'instant' })
    }
    origin = undefined
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
}

let currentLocale = getInitialLocale()
let currentThemeMode = getInitialThemeMode()

document.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.site-header')) return
  document.querySelector('.site-menu-button[aria-expanded="true"]')?.setAttribute('aria-expanded', 'false')
})

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return
  const menuButton = document.querySelector('.site-menu-button[aria-expanded="true"]')
  if (!menuButton) return
  menuButton.setAttribute('aria-expanded', 'false')
  menuButton.focus()
})

const colorSchemeMedia = window.matchMedia('(prefers-color-scheme: dark)')

if (typeof colorSchemeMedia.addEventListener === 'function') {
  colorSchemeMedia.addEventListener('change', () => {
    if (currentThemeMode === 'system') {
      renderApp(currentLocale, currentThemeMode)
    }
  })
}

renderApp(currentLocale, currentThemeMode)
