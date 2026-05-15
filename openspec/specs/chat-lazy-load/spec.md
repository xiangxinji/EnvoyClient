## ADDED Requirements

### Requirement: Default message limit of 50
The chat panel SHALL display only the most recent 50 messages by default when loading a conversation. Older messages SHALL NOT be rendered until explicitly loaded.

#### Scenario: Conversation with more than 50 messages
- **WHEN** a conversation contains 200 messages
- **THEN** the chat panel SHALL display only the most recent 50 messages

#### Scenario: Conversation with fewer than 50 messages
- **WHEN** a conversation contains 30 messages
- **THEN** the chat panel SHALL display all 30 messages without any load-more trigger

### Requirement: Scroll-to-top triggers history loading
The chat panel SHALL detect when the user scrolls to the top of the message list and load the next batch of older messages (50 at a time). A loading indicator SHALL be shown during loading.

#### Scenario: User scrolls to top
- **WHEN** the user scrolls to the top of the message list and there are older messages available
- **THEN** the system SHALL prepend the next 50 older messages to the conversation view and maintain the user's scroll position relative to the content

#### Scenario: No more messages to load
- **WHEN** the user scrolls to the top and all history has been loaded
- **THEN** no loading indicator SHALL appear and no further loading SHALL trigger

#### Scenario: Loading in progress
- **WHEN** a history load is already in progress
- **THEN** additional scroll-to-top events SHALL NOT trigger duplicate loads

### Requirement: New message auto-scroll
The chat panel SHALL auto-scroll to the bottom when a new message arrives, preserving the existing behavior. Auto-scroll SHALL NOT trigger when the user has scrolled up to view older messages.

#### Scenario: New message while at bottom
- **WHEN** a new message arrives and the user is at the bottom of the chat
- **THEN** the chat SHALL auto-scroll to show the new message

#### Scenario: New message while scrolled up
- **WHEN** a new message arrives and the user has scrolled up to view history
- **THEN** the chat SHALL NOT auto-scroll and the user's position SHALL be preserved
