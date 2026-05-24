## MODIFIED Requirements

### Requirement: Member settings schema
The `MemberSettings` interface SHALL include the following new fields:

- `brains_sync_triggers`: `("interval" | "after_task")[]` — multi-select sync trigger options, default `[]`
- `brains_sync_interval_hours`: `number` — sync interval in hours when "interval" trigger is active, default `1`

#### Scenario: Loading settings with new fields
- **WHEN** `loadSettings` is called and the stored settings have no `brains_sync_triggers` or `brains_sync_interval_hours` fields
- **THEN** the system SHALL use `[]` as default for `brains_sync_triggers` and `1` as default for `brains_sync_interval_hours`

#### Scenario: Saving sync trigger settings
- **WHEN** user changes sync trigger selection in the UI
- **THEN** the system SHALL call `saveSettings` with the updated `brains_sync_triggers` array and persist it via Tauri settings

#### Scenario: Saving sync interval
- **WHEN** user changes the sync interval input
- **THEN** the system SHALL call `saveSettings` with the updated `brains_sync_interval_hours` value, clamped to minimum `0.5` and maximum `24`
