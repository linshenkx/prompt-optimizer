export default {
  browserBridge: {
    title: 'Allow MCP to connect to this page?',
    connection: 'MCP connection',
    connected: 'MCP connected',
    lifetime: 'Closing this tab disconnects it.',
    label: 'Name this browser profile (optional)',
    readScope: 'Allow reading this profile’s data and saved results. Queries hide model keys.',
    businessScope: 'Allow managing this profile’s data, importing and exporting backups, and using its models. Model calls send prompts to your provider and may incur charges. Credential exports include saved keys.',
    compareScope: 'Allow editing favorites, optimizing and testing prompts, and managing saved comparisons. Model calls send prompts to your provider and may incur charges.',
    authorize: 'Allow connection',
    revoke: 'Disconnect',
    failure: 'Connection failed. Check that your local MCP is running and the browser allows local network access, then ask your assistant for a new link.',
  },
}
