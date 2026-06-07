# Agent Execution

Agents are intelligent entities that automate task execution through a ReAct loop (Reason-Act-Observe).

## Auto and Manual Mode

Switch task execution mode in settings: in auto mode, the Agent executes immediately upon receiving a task; in manual mode, you need to click the "Execute Task" button to trigger execution.

## ReAct Loop

The Agent executes tasks using a ReAct loop: each step involves reasoning (analyzing current state), selecting an appropriate tool to act, then observing the result. The loop continues until the task is complete, with a maximum of 20 steps.

## Shell Tool

In the Tauri desktop environment, the Agent can execute shell commands for compiling code, running scripts, and other operations. Execution timeout is 60 seconds.

## File Read/Write Tools

The Agent can read and write local files for viewing code, modifying configurations, and other operations.

## Resource Upload Tool

The Agent can upload local files as task resources, making it easy for Leaders to review execution outputs.

## Cloud Operation Tools

The Agent can list team cloud resource directories and upload files to the cloud, enabling interaction with the cloud drive.

## Skill Catalog

The Agent can read skill files from `~/.envoy/brains/{user}/skills/` to access domain-specific operation guides.
