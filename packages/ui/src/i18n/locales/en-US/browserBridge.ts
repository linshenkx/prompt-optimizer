export default {
  browserBridge: {
    title: 'Codex connection',
    connecting: 'Connecting…',
    connected: 'This page is authorized and connected',
    disconnected: 'This page is not connected',
    context: 'Only this page and this browser profile’s product data are shared. Closing this page or revoking access disconnects Codex. No browser profile files are read.',
    label: 'Source label (for example Firefox — work)',
    readScope: 'Authorize reading this page’s data and saved results. Queries redact model credentials.',
    businessScope: 'Authorize managing this page’s data, using saved models, and importing or exporting backups. A separate credential export request may include model keys.',
    compareScope: 'Authorize reading and editing favorites, optimizing and testing prompts with saved text models, and saving, reading or deleting comparisons. Model credentials stay in this page.',
    charges: 'Optimization and tests send prompts to your configured providers and may incur charges. Model requests use this browser’s network settings.',
    authorize: 'Authorize this page',
    revoke: 'Revoke access now',
    instructions: 'In Codex, ask Prompt Optimizer MCP to authorize your deployed product URL with po_sources_authorize, then open its one-use link in the desired browser profile.',
    failure: 'Could not maintain the connection. Check browser local-network permission, page policy and that the local MCP is running. Ask Codex for a new link after a failed or expired authorization.',
  },
}
