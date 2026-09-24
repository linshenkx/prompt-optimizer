---
hide:
  - toc
---

<div class="po-docs-home">
  <section class="po-docs-hero">
    <div class="po-docs-badge">Prompt Optimizer Docs</div>
    <div class="po-docs-hero-main">
      <div class="po-docs-hero-copy">
        <h1>从一句提示词，<br>开始第一次优化</h1>
        <p class="po-docs-lead">
          先接入 1 个文本模型，再按快速开始完成一次优化。跑通后再学习测试、评估和其他工作区。
        </p>
        <div class="po-docs-actions">
          <a class="md-button md-button--primary" href="user/quick-start/">从这里开始</a>
          <a class="md-button" href="basic/models/">如何配置模型</a>
          <a class="md-button" href="user/choose-workspace/">选择工作区</a>
        </div>
      </div>
      <div class="po-docs-hero-aside">
        <div class="po-docs-hero-note">
          <span>01</span>
          <div>
            <strong>先准备 1 个文本模型</strong>
            <p>需要自己的模型服务与 API Key，或可用的本地模型。</p>
          </div>
        </div>
        <div class="po-docs-hero-note">
          <span>02</span>
          <div>
            <strong>完成第一次优化</strong>
            <p>输入一句任务要求，获得并复制优化后的提示词。</p>
          </div>
        </div>
        <div class="po-docs-hero-note">
          <span>03</span>
          <div>
            <strong>需要时再测试效果</strong>
            <p>比较模型的实际输出，决定是否继续修改。</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="po-docs-section po-docs-section--starter">
    <div class="po-docs-section-head">
      <h2>第一次使用</h2>
      <p>快速开始包含配置与优化的完整步骤；也可以直接查看模型配置。</p>
    </div>
    <div class="po-docs-step-strip">
      <a class="po-docs-step" href="user/quick-start/">
        <span class="po-docs-step-index">01</span>
        <div>
          <h3>快速开始</h3>
          <p>从模型配置到复制结果。</p>
        </div>
      </a>
      <a class="po-docs-step" href="basic/models/">
        <span class="po-docs-step-index">02</span>
        <div>
          <h3>模型管理</h3>
          <p>按实际界面填写并测试连接。</p>
        </div>
      </a>
      <a class="po-docs-step" href="user/choose-workspace/">
        <span class="po-docs-step-index">03</span>
        <div>
          <h3>选择工作区</h3>
          <p>按要完成的任务选择。</p>
        </div>
      </a>
      <a class="po-docs-step" href="user/testing-evaluation/">
        <span class="po-docs-step-index">04</span>
        <div>
          <h3>测试与评估</h3>
          <p>用实际输出检验修改效果。</p>
        </div>
      </a>
    </div>
  </section>

  <section class="po-docs-section po-docs-section--workspace">
    <div class="po-docs-section-head">
      <h2>按工作区进入</h2>
      <p>不同工作区，对应不同输入结构。</p>
    </div>
    <div class="po-docs-index-list">
      <a class="po-docs-index-row" href="basic/system-optimization/">
        <div>
          <h3>系统提示词工作区</h3>
          <p>优化角色、规则、边界与输出规范。</p>
        </div>
        <code>/basic/system</code>
      </a>
      <a class="po-docs-index-row" href="basic/user-optimization/">
        <div>
          <h3>用户提示词工作区</h3>
          <p>优化直接发给模型的一条任务提示词。</p>
        </div>
        <code>/basic/user</code>
      </a>
      <a class="po-docs-index-row" href="advanced/variables/">
        <div>
          <h3>变量工作区</h3>
          <p>把提示词沉淀成模板，分离固定结构与可变输入。</p>
        </div>
        <code>/pro/variable</code>
      </a>
      <a class="po-docs-index-row" href="advanced/context/">
        <div>
          <h3>多消息工作区</h3>
          <p>在完整上下文里优化某条消息，而不是脱离会话单看一句话。</p>
        </div>
        <code>/pro/multi</code>
      </a>
      <a class="po-docs-index-row" href="image/text2image-workspace/">
        <div>
          <h3>文生图工作区</h3>
          <p>围绕图像生成结果比较不同提示词的效果。</p>
        </div>
        <code>/image/text2image</code>
      </a>
      <a class="po-docs-index-row" href="image/image2image-workspace/">
        <div>
          <h3>图生图工作区</h3>
          <p>结合参考图继续优化生成方向与风格控制。</p>
        </div>
        <code>/image/image2image</code>
      </a>
      <a class="po-docs-index-row" href="image/multiimage-workspace/">
        <div>
          <h3>多图生图工作区</h3>
          <p>用多张输入图共同约束主体关系、顺序语义与最终生成目标。</p>
        </div>
        <code>/image/multiimage</code>
      </a>
    </div>
  </section>

  <section class="po-docs-section po-docs-section--auxiliary">
    <div class="po-docs-section-head">
      <h2>提示词资产与辅助功能</h2>
      <p>提示词可以来自手写、模板、本地导入或 Prompt Garden 提示词库，稳定后再沉淀为收藏资产。</p>
    </div>
    <div class="po-docs-index-list">
      <a class="po-docs-index-row" href="basic/prompt-garden/">
        <div>
          <h3>Prompt Garden 提示词库</h3>
          <p>作为可选提示词来源，发现可导入的提示词、示例和媒体素材。</p>
        </div>
        <code>/basic/prompt-garden</code>
      </a>
      <a class="po-docs-index-row" href="basic/favorites/">
        <div>
          <h3>收藏与导入</h3>
          <p>把稳定提示词保存为可复用资产，保留示例、媒体和来源信息。</p>
        </div>
        <code>/basic/favorites</code>
      </a>
      <a class="po-docs-index-row" href="auxiliary/smart-fill/">
        <div>
          <h3>变量智能填充</h3>
          <p>填写核心变量，AI 自动推导其他变量。</p>
        </div>
        <code>/auxiliary/smart-fill</code>
      </a>
      <a class="po-docs-index-row" href="auxiliary/replicate/">
        <div>
          <h3>文生图复刻</h3>
          <p>从参考图反推提示词和变量。</p>
        </div>
        <code>/auxiliary/replicate</code>
      </a>
      <a class="po-docs-index-row" href="auxiliary/style-learn/">
        <div>
          <h3>风格学习</h3>
          <p>保留提示词主体，学习参考图风格。</p>
        </div>
        <code>/auxiliary/style-learn</code>
      </a>
    </div>
  </section>

  <section class="po-docs-section po-docs-section--deep">
    <div class="po-docs-section-head">
      <h2>继续深入</h2>
      <p>跑通第一次使用后，再看部署、排障和集成。</p>
    </div>
    <div class="po-docs-link-shelf">
      <a class="po-docs-link-tile" href="deployment/desktop/">
        <div class="po-docs-link-meta">部署</div>
        <h3>桌面版与部署方式</h3>
        <p>查看 Web、桌面版、Docker、Chrome 插件和 MCP 的部署方式。</p>
      </a>
      <a class="po-docs-link-tile" href="help/common-questions/">
        <div class="po-docs-link-meta">排障</div>
        <h3>常见问题与排障</h3>
        <p>从连接问题、故障排除到技术支持入口，先查这里。</p>
      </a>
      <a class="po-docs-link-tile" href="user/mcp-server/">
        <div class="po-docs-link-meta">集成</div>
        <h3>MCP 服务器</h3>
        <p>了解如何把 Prompt Optimizer 能力暴露给外部客户端或自动化流程。</p>
      </a>
    </div>
  </section>
</div>
