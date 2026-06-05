---
hide:
  - toc
---

<div class="po-docs-home">
  <section class="po-docs-hero">
    <div class="po-docs-badge">GlobalCloud XiaoC Docs</div>
    <div class="po-docs-hero-main">
      <div class="po-docs-hero-copy">
        <h1>Set up a model,<br>then run a workflow</h1>
        <p class="po-docs-lead">
          Most first-time users do not get stuck on the UI. They get stuck before the first run because no model is configured. Start with one text model, then run one real workflow.
        </p>
        <div class="po-docs-actions">
          <a class="md-button md-button--primary" href="basic/models/">Configure Models</a>
          <a class="md-button" href="user/quick-start/">Quick Start</a>
          <a class="md-button" href="user/choose-workspace/">Choose Workspace</a>
        </div>
      </div>
      <div class="po-docs-hero-aside">
        <div class="po-docs-hero-note">
          <span>01</span>
          <div>
            <strong>Must do: configure 1 text model</strong>
            <p>Without it, analysis, optimization, testing, and evaluation will not run.</p>
          </div>
        </div>
        <div class="po-docs-hero-note">
          <span>02</span>
          <div>
            <strong>Must do: run one result</strong>
            <p>Complete one optimize, test, and evaluate cycle first.</p>
          </div>
        </div>
        <div class="po-docs-hero-note">
          <span>03</span>
          <div>
            <strong>Then learn the boundaries</strong>
            <p>Then separate workspace input structure from evaluation semantics.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="po-docs-section po-docs-section--starter">
    <div class="po-docs-section-head">
      <h2>First-time setup</h2>
      <p>Follow this order to avoid the most common blockers.</p>
    </div>
    <div class="po-docs-step-strip">
      <a class="po-docs-step" href="basic/models/">
        <span class="po-docs-step-index">01</span>
        <div>
          <h3>Configure Models</h3>
          <p>Start with one text model.</p>
        </div>
      </a>
      <a class="po-docs-step" href="user/quick-start/">
        <span class="po-docs-step-index">02</span>
        <div>
          <h3>Quick Start</h3>
          <p>Run one complete workflow.</p>
        </div>
      </a>
      <a class="po-docs-step" href="user/choose-workspace/">
        <span class="po-docs-step-index">03</span>
        <div>
          <h3>Choose Workspace</h3>
          <p>Match the page to your input structure.</p>
        </div>
      </a>
      <a class="po-docs-step" href="user/testing-evaluation/">
        <span class="po-docs-step-index">04</span>
        <div>
          <h3>Testing &amp; Evaluation</h3>
          <p>Separate analysis from evaluation.</p>
        </div>
      </a>
    </div>
  </section>

  <section class="po-docs-section po-docs-section--workspace">
    <div class="po-docs-section-head">
      <h2>Choose a workspace</h2>
      <p>Each workspace has a different input structure.</p>
    </div>
    <div class="po-docs-index-list">
      <a class="po-docs-index-row" href="basic/system-optimization/">
        <div>
          <h3>System Prompt Workspace</h3>
          <p>Optimize roles, rules, boundaries, and output policy.</p>
        </div>
        <code>/basic/system</code>
      </a>
      <a class="po-docs-index-row" href="basic/user-optimization/">
        <div>
          <h3>User Prompt Workspace</h3>
          <p>Optimize one direct task prompt sent to the model.</p>
        </div>
        <code>/basic/user</code>
      </a>
      <a class="po-docs-index-row" href="advanced/variables/">
        <div>
          <h3>Variable Workspace</h3>
          <p>Turn one prompt into a reusable template with variable boundaries.</p>
        </div>
        <code>/advanced/variables</code>
      </a>
      <a class="po-docs-index-row" href="advanced/context/">
        <div>
          <h3>Context Workspace</h3>
          <p>Optimize one target message inside a real conversation.</p>
        </div>
        <code>/advanced/context</code>
      </a>
      <a class="po-docs-index-row" href="image/text2image-workspace/">
        <div>
          <h3>Text-to-Image Workspace</h3>
          <p>Compare visual generation outcomes across prompt versions.</p>
        </div>
        <code>/image/text2image</code>
      </a>
      <a class="po-docs-index-row" href="image/image2image-workspace/">
        <div>
          <h3>Image-to-Image Workspace</h3>
          <p>Iterate from a reference image while preserving the baseline.</p>
        </div>
        <code>/image/image2image</code>
      </a>
      <a class="po-docs-index-row" href="image/multiimage-workspace/">
        <div>
          <h3>Multi-Image Workspace</h3>
          <p>Use multiple ordered input images to constrain subject relationships and the final generation goal.</p>
        </div>
        <code>/image/multiimage</code>
      </a>
    </div>
  </section>

  <section class="po-docs-section po-docs-section--auxiliary">
    <div class="po-docs-section-head">
      <h2>Prompt Assets and Auxiliary Features</h2>
      <p>Prompts can start from manual writing, templates, local imports, or Prompt Garden, then become reusable favorite assets.</p>
    </div>
    <div class="po-docs-index-list">
      <a class="po-docs-index-row" href="basic/prompt-garden/">
        <div>
          <h3>Prompt Garden</h3>
          <p>Use it as an optional prompt source for importable prompts, examples, and media.</p>
        </div>
        <code>/basic/prompt-garden</code>
      </a>
      <a class="po-docs-index-row" href="basic/favorites/">
        <div>
          <h3>Favorites &amp; Import</h3>
          <p>Save stable prompts as reusable assets with examples, media, and source details.</p>
        </div>
        <code>/basic/favorites</code>
      </a>
      <a class="po-docs-index-row" href="auxiliary/smart-fill/">
        <div>
          <h3>Smart Variable Fill</h3>
          <p>Fill core variables, AI automatically derives other variables.</p>
        </div>
        <code>/auxiliary/smart-fill</code>
      </a>
      <a class="po-docs-index-row" href="auxiliary/replicate/">
        <div>
          <h3>Text-to-Image Replicate</h3>
          <p>Reverse-engineer prompts and variables from reference images.</p>
        </div>
        <code>/auxiliary/replicate</code>
      </a>
      <a class="po-docs-index-row" href="auxiliary/style-learn/">
        <div>
          <h3>Style Learning</h3>
          <p>Preserve prompt subject, learn style from reference images.</p>
        </div>
        <code>/auxiliary/style-learn</code>
      </a>
    </div>
  </section>

  <section class="po-docs-section po-docs-section--deep">
    <div class="po-docs-section-head">
      <h2>Keep going</h2>
      <p>After your first working run, continue with deployment, troubleshooting, and integration.</p>
    </div>
    <div class="po-docs-link-shelf">
      <a class="po-docs-link-tile" href="deployment/desktop/">
        <div class="po-docs-link-meta">Deploy</div>
        <h3>Desktop and Deployment</h3>
        <p>See the Web, desktop, Docker, extension, and MCP deployment options.</p>
      </a>
      <a class="po-docs-link-tile" href="help/common-questions/">
        <div class="po-docs-link-meta">Troubleshoot</div>
        <h3>FAQ and Troubleshooting</h3>
        <p>Start here for connection issues, troubleshooting steps, and support links.</p>
      </a>
      <a class="po-docs-link-tile" href="user/mcp-server/">
        <div class="po-docs-link-meta">Integrate</div>
        <h3>MCP Server</h3>
        <p>Expose GlobalCloud XiaoC to external clients and automation workflows.</p>
      </a>
    </div>
  </section>
</div>
