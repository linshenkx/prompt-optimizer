# Refine a prompt with web references

This runnable MCP client searches with [Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp), then passes source URLs and excerpts to Prompt Optimizer's `iterate-prompt` tool. It prints a reusable refined prompt. Search uses Fast mode and needs no Parallel account or API key. The anonymous service is intended for exploration and light use and has rate limits.

Use this when a prompt needs current terminology or concrete constraints from reference pages. This is an explicit tool pipeline; it does not execute the resulting prompt or run an autonomous agent.

## Setup

Use Node.js 24. First start Prompt Optimizer's HTTP MCP server with a configured text model, following the [MCP server guide](../../docs/user/mcp-server_en.md). The default URL below is the local developer server; Docker users can supply `--optimizer http://localhost:8081/mcp`. The example expects an accessible server without additional HTTP authentication.

Install this standalone example's dependencies from its directory:

```sh
cd examples/research-prompt
npm install
```

The example is outside the pnpm workspace and does not change the app's configuration. Prompt Optimizer still uses the model you configured, including its usual inference costs. Your objective and queries go to Parallel; your prompt and retrieved excerpts go to that model through Prompt Optimizer. Review the generated prompt and source material before use.

## Run

The included `prompt.txt` asks for a Node.js migration checklist:

```sh
node research-prompt.mjs \
  --prompt prompt.txt \
  --objective "Find current Node.js LTS migration requirements from official documentation" \
  --query "Node.js current LTS migration" \
  --query "Node.js release support schedule" \
  > refined-prompt.txt
```

Search excerpts are normally sufficient. To request exact material from a particular page, also pass `--url`, for example:

```sh
node research-prompt.mjs \
  --prompt prompt.txt \
  --objective "Find current Node.js LTS migration requirements from official documentation" \
  --query "Node.js current LTS migration" \
  --url https://nodejs.org/en/about/previous-releases \
  --optimizer http://localhost:8081/mcp
```

Repeat `--query` or `--url` as needed (at most 20 URLs). The objective is limited to 200 characters. The example includes up to three sources from each tool, with bounded excerpts, and asks the optimizer to treat retrieved text as reference data. It stops on missing tools, MCP errors, any failed explicitly requested page fetch, empty source context, or empty optimizer output. Requests time out after 60 seconds. When the run ends, it requests session termination and closes connections, including on failure. It does not read or send saved Parallel credentials or API keys.

Run the local protocol and error-path tests with `npm test`.
