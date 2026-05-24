## ADDED Requirements

### Requirement: Brains sync triggers configuration
The system SHALL allow users to configure brains sync triggers as a multi-select array from the options: "interval" (fixed interval) and "after_task" (after own task completes). An empty array means sync is disabled.

#### Scenario: User enables interval sync
- **WHEN** user selects the "interval" trigger option
- **THEN** the system SHALL save `brains_sync_triggers` containing "interval" and start a periodic sync timer based on `brains_sync_interval_hours`

#### Scenario: User enables after-task sync
- **WHEN** user selects the "after_task" trigger option
- **THEN** the system SHALL save `brains_sync_triggers` containing "after_task" and register a task completion listener

#### Scenario: User disables all triggers
- **WHEN** user deselects all trigger options, resulting in an empty array
- **THEN** the system SHALL stop all sync timers and unregister task listeners; no automatic sync SHALL occur

#### Scenario: Default state
- **WHEN** a new user first loads settings
- **THEN** `brains_sync_triggers` SHALL default to `[]` (disabled) and `brains_sync_interval_hours` SHALL default to `1`

### Requirement: Incremental sync with local manifest
The system SHALL perform incremental sync by comparing file hashes against a local manifest (`~/.envoy/brains/{username}/.sync_manifest.json`). Only new or changed files SHALL be uploaded.

#### Scenario: First sync with no manifest
- **WHEN** sync runs for the first time and no manifest exists
- **THEN** the system SHALL treat all local files as new, upload each to `backups/brains/{username}/{relative_path}`, and create the manifest

#### Scenario: Subsequent sync with no changes
- **WHEN** sync runs and all file hashes match the manifest
- **THEN** the system SHALL skip all files, update `lastSyncAt` in the manifest, and complete immediately

#### Scenario: File modified since last sync
- **WHEN** a local file's hash differs from the manifest entry
- **THEN** the system SHALL upload the updated file to the same cloud path and update the manifest entry

#### Scenario: New file added locally
- **WHEN** a local file exists that has no entry in the manifest
- **THEN** the system SHALL upload it to `backups/brains/{username}/{relative_path}` and add a manifest entry

#### Scenario: Local file deleted
- **WHEN** a manifest entry has no corresponding local file
- **THEN** the system SHALL rename the cloud backup file from `{name}.{ext}` to `{name}.backup.{ext}` and remove the manifest entry

### Requirement: Sync only while logged in
The system SHALL only perform sync operations when the user is logged in and the TeamClient connection is active. Sync timers and listeners SHALL be cleaned up on logout.

#### Scenario: Login triggers sync setup
- **WHEN** user logs in and establishes a TeamClient connection
- **THEN** the system SHALL load sync settings and register the configured triggers

#### Scenario: Logout stops sync
- **WHEN** user logs out or the connection drops
- **THEN** the system SHALL clear all sync timers and unregister all task listeners

### Requirement: After-task sync trigger filtering
When the "after_task" trigger is enabled, the system SHALL only trigger sync when a task completes AND the current user was a subscriber (executor) of that task.

#### Scenario: Own task completes
- **WHEN** a task with `status === "completed"` is received and `task.subscribe.includes(myId)` is true
- **THEN** the system SHALL trigger a sync operation

#### Scenario: Other member's task completes
- **WHEN** a task with `status === "completed"` is received and `task.subscribe.includes(myId)` is false
- **THEN** the system SHALL NOT trigger a sync operation

### Requirement: Sync progress display
The system SHALL expose reactive sync state (`syncing`, `syncPhase`, `syncProgress`, `lastSyncAt`, `syncError`) and display progress in two locations: a detailed progress section in SettingsTask and a lightweight indicator in the sidebar.

#### Scenario: Sync in progress in settings panel
- **WHEN** a sync operation is running and user is viewing SettingsTask
- **THEN** the settings panel SHALL show a progress bar with "syncing X/N files" and the current file name being uploaded

#### Scenario: Sync in progress in sidebar
- **WHEN** a sync operation is running
- **THEN** the sidebar SHALL show a spinning icon with "syncing X/N" text at the bottom; the indicator SHALL disappear when sync completes

#### Scenario: Sync error
- **WHEN** a sync operation fails
- **THEN** the SettingsTask panel SHALL show an error message with a retry button; `syncError` SHALL contain the error description

#### Scenario: Sync idle
- **WHEN** no sync is in progress and the last sync succeeded
- **THEN** the SettingsTask panel SHALL show "last synced at {timestamp}" with a success indicator

### Requirement: Manual restore from cloud
The system SHALL provide a restore button in SettingsTask that downloads all non-backup files from `backups/brains/{username}/` and overwrites the local brains directory.

#### Scenario: User triggers restore
- **WHEN** user clicks the restore button
- **THEN** the system SHALL show a danger confirmation dialog warning that local files will be overwritten

#### Scenario: User confirms restore
- **WHEN** user confirms the restore operation
- **THEN** the system SHALL list all files in `backups/brains/{username}/`, download each file (excluding `.backup.*` files), write them to the local brains directory, update the manifest, and show a success toast

#### Scenario: Restore skips backup files
- **WHEN** the cloud backup contains files matching the pattern `*.backup.*`
- **THEN** the system SHALL skip those files during restore

### Requirement: Concurrent sync prevention
The system SHALL prevent concurrent sync operations. If a sync is already in progress, additional trigger events SHALL be silently ignored.

#### Scenario: Sync already running
- **WHEN** a sync trigger fires while `syncing` is true
- **THEN** the system SHALL skip the triggered sync without error

### Requirement: Tauri scan_brains_files command
The system SHALL provide a Tauri command `scan_brains_files` that recursively lists all files under `~/.envoy/brains/{username}/` (excluding `.sync_manifest.json` and hidden files), returning an array of `{ path, hash, size }`.

#### Scenario: Scanning brains directory
- **WHEN** `scan_brains_files` is invoked with a username
- **THEN** the command SHALL recursively walk `~/.envoy/brains/{username}/`, compute a content hash for each file, and return the file list with relative paths

#### Scenario: Empty brains directory
- **WHEN** the brains directory exists but contains no files
- **THEN** the command SHALL return an empty array

### Requirement: Tauri restore_brains command
The system SHALL provide a Tauri command `restore_brains` that receives a list of `{ path, content }` entries and writes each to `~/.envoy/brains/{username}/`, creating directories as needed.

#### Scenario: Restoring files
- **WHEN** `restore_brains` is invoked with username and file entries
- **THEN** the command SHALL create any missing directories and write each file, overwriting existing content
