---
description: Solve the current Baba Is You level
agent: baba
---

Solve the current Baba Is You level.

## Basic Rules

!`jq -r '.basic.content' help_rules.json`

## Rule Properties

Each rule affects objects in the game. Here are all available properties:

### STOP Rule

!`jq -r '.stop.content' help_rules.json`

### PUSH Rule

!`jq -r '.push.content' help_rules.json`

### WIN Rule

!`jq -r '.win.content' help_rules.json`

### YOU Rule

!`jq -r '.you.content' help_rules.json`

### DEFEAT Rule

!`jq -r '.defeat.content' help_rules.json`

### SINK Rule

!`jq -r '.sink.content' help_rules.json`

### MOVE Rule

!`jq -r '.move.content' help_rules.json`

### HOT Rule

!`jq -r '.hot.content' help_rules.json`

### MELT Rule

!`jq -r '.melt.content' help_rules.json`

### OPEN Rule

!`jq -r '.open.content' help_rules.json`

### SHUT Rule

!`jq -r '.shut.content' help_rules.json`
