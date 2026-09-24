# Data Management

The data management entry lives in the top toolbar as **Data Management**.

Its main job is local backup, restore, inspection, and migration. It is not cloud sync.

## What this page is best for

- exporting a full local backup
- importing that backup on another device
- moving context collections separately
- checking where desktop data is stored
- spotting abnormal storage growth before it becomes a startup problem

## What the current UI can do

### Full data export

You can export one complete local backup file that includes multiple areas of app data, such as:

- history
- model configs
- custom templates
- user settings
- context data

The format is JSON. It is intended for local backup and migration.

### Full data import

You can import a previously exported JSON backup into the current environment.

Be careful when importing:

- it can affect existing local data
- model configs may include saved API keys or other sensitive settings
- if a backup file comes from someone else, inspect it before importing

### Remote backup (v2.11.0)

Data Management also supports deployment-aware remote backups. It is useful when you want to back up local app data, favorites, and related image resources to a configured remote storage provider, then restore from the remote backup list later.

Keep these points in mind:

- Remote backup is a data-safety and migration helper. It is not multi-user cloud sync.
- Available providers depend on runtime and deployment configuration; desktop and web connections are not identical.
- Backups try to include app data, favorites, image cache resources, and favorite image resources.
- Before restore, you can choose the restore scope, such as app data, favorites, or the matching image resources.
- If a backup was created with missing image resources, the restore UI warns you; when needed, restore only the JSON data.

Before sharing or restoring a remote backup, check whether it contains model configs, API keys, private prompts, image assets, or other sensitive content.

### Context collection import and export

Data management also supports separate import and export for context collections:

- export to file
- export to clipboard
- import from file
- import from clipboard

This is better for moving advanced context setups without replacing the entire local environment.

### Storage overview

Recent versions also make the storage overview easier to read.

The current UI can summarize storage regions and their approximate footprint so you can answer questions like:

- which category is growing unusually fast
- how large the local data roughly is on this device
- whether you should inspect or clean something before exporting

The goal is not exact accounting. The goal is earlier visibility into abnormal growth.

## What extra information appears on desktop

In the desktop app, data management can also show local storage details such as:

- the user data directory path
- primary data file size
- backup file size
- open storage directory
- refresh storage information

These details are mainly for troubleshooting local persistence issues. The browser version usually cannot expose the same filesystem-level view.

## Where data is stored by default

Storage location depends on how you run the app:

- Web: inside the browser's local storage environment for that site
- Desktop: inside the local app data directory on your machine
- Extension: inside the extension's own local storage space

This is not a cloud-sync or shared-team-data feature.

## How startup repair relates to data management

Recent releases made startup storage checks more proactive.

That means:

- Data Management is still your manual backup and restore entry point
- startup repair exists to keep the app bootable when local data is obviously damaged
- some clearly invalid, damaged, or unreferenced data may be cleaned automatically

The safest habit is still the same: export a backup before large changes.

## Data management vs favorites import/export

These two entry points are easy to confuse, but they work at different levels:

- **Data Management**: whole-environment backup and restore, with broader impact
- **Favorites & Import**: selective migration and sharing of chosen content, not a full machine backup

If you only want to carry over a few verified prompts, start with [Favorites & Import](favorites.md).

## Full app backup and favorites package

Use the export that matches what you want to move:

| Entry point | Current output | Best for |
| --- | --- | --- |
| **Data Management → Full Export** | App data JSON, including model settings, history, and templates; inspect for keys before sharing | Moving or backing up the app's data |
| **Favorites → Export** | A `.po-favorites.zip` package with favorites and available referenced images | Moving or sharing favorites and media |

The favorites export may warn if referenced resources are missing. In that case, the package may not contain every image. It is not a full app backup. See [Favorites & Import](favorites.md) for other sharing formats.

## Recommended usage

- export one full backup before large changes
- check for sensitive configs before sharing backup files
- use context collection import/export when you only need context migration
- if import fails, first verify that the JSON is complete and was exported by the app

## Related pages

- [History Management](history.md)
- [Favorites & Import](favorites.md)
- [Context Workspace](../advanced/context.md)
- [Variable Workspace](../advanced/variables.md)
- [Troubleshooting](../help/troubleshooting.md)
