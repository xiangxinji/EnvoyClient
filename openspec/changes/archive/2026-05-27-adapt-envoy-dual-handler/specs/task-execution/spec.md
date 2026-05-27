## MODIFIED Requirements

### Requirement: Task handler registration
The system SHALL register two independent handlers on the envoy Client:
- `client.doing(fn)` for execute tasks (`reason === "execute"`)
- `client.reviewing(fn)` for review tasks (`reason === "review"`)

The `doing()` handler SHALL NOT check `serverTask.status === "reviewing"` to route review tasks. Review tasks SHALL be handled exclusively by the `reviewing()` handler.

#### Scenario: Leader receives review dispatch
- **WHEN** envoy Client receives a dispatch message with `subtype: "review"`
- **THEN** the task is routed to the `reviewing()` handler, which calls `handleLeaderReview()`
- **AND** the task does NOT enter the `doing()` handler

#### Scenario: Member receives execute dispatch
- **WHEN** envoy Client receives a dispatch message without `subtype: "review"`
- **THEN** the task is routed to the `doing()` handler
- **AND** the task is bridged to UI via `currentClientTask` ref

### Requirement: No autoSendResult dependency
The system SHALL NOT pass `autoSendResult` in `ClientOptions`. Results SHALL continue to be submitted via HTTP API (`taskService.submitResult`) through the existing outbox mechanism.

#### Scenario: ClientOptions construction
- **WHEN** creating a Leader or Member client instance
- **THEN** the options object does not include `autoSendResult` property
- **AND** the client compiles without TypeScript errors

### Requirement: Review handler must be registered for Leader
The system SHALL register a `reviewing()` handler when the client role is Leader. If `reviewing()` is not registered, review tasks will block the envoy Client's serial queue, preventing all subsequent execute tasks from being processed.

#### Scenario: Leader client initialization
- **WHEN** a Leader client connects and `registerHandler` is called
- **THEN** both `client.doing()` and `client.reviewing()` are registered
- **AND** review tasks do not block the task queue
