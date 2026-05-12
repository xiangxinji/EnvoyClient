## ADDED Requirements

### Requirement: Title bar displays current username
The TitleBar component SHALL accept a `username` prop and display it next to the app name. When username is provided, the title bar SHALL show the format "Envoy · {username}".

#### Scenario: Username displayed after login
- **WHEN** a user logs in and enters the chat view
- **THEN** the title bar SHALL show "Envoy · {username}" with the logged-in username

#### Scenario: No username before login
- **WHEN** the user is on the role selection screen
- **THEN** the title bar SHALL show only "Envoy" without any username suffix

#### Scenario: Multiple windows distinguishable
- **WHEN** two Member clients are open with different usernames "alice" and "bob"
- **THEN** the title bars SHALL display "Envoy · alice" and "Envoy · bob" respectively
