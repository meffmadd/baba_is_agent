#!/bin/bash
# Extract allowed tools from agent config and their descriptions from tool files

AGENT_FILE=".opencode/agents/baba.md"
TOOLS_DIR=".opencode/tools"

# Check if agent file exists
if [ ! -f "$AGENT_FILE" ]; then
    echo "Error: Agent file not found at $AGENT_FILE"
    exit 1
fi

echo ""

# Extract allowed tool names (lines like "  tool_name: allow")
grep -E '^\s+[a-z_]+:\s*allow$' "$AGENT_FILE" | sed 's/^[[:space:]]*//; s/:.*$//' | while read -r tool_name; do
    # Skip built-in tools that don't have separate files
    if [ "$tool_name" = "read" ] || [ "$tool_name" = "bash" ] || [ "$tool_name" = "todowrite" ] || [ "$tool_name" = "glob" ] || [ "$tool_name" = "write" ] || [ "$tool_name" = "edit" ] || [ "$tool_name" = "grep" ]; then
        continue
    fi
    
    tool_file="$TOOLS_DIR/$tool_name.ts"
    
    if [ -f "$tool_file" ]; then
        # Extract description using Python to handle multiline strings with concatenation
        description=$(python3 << EOF
import re

with open('$tool_file', 'r') as f:
    content = f.read()

# Match description: followed by quoted strings possibly concatenated with +
# Pattern matches: description: "string" or description: "string" + "string" ...
pattern = r'description:\s*("[^"]*"(?:\s*\+\s*"[^"]*")*)'
match = re.search(pattern, content, re.DOTALL)
if match:
    desc = match.group(1)
    # Remove all quotes and plus signs, then clean up whitespace
    desc = desc.replace('"', '').replace('+', '')
    # Normalize whitespace
    desc = ' '.join(desc.split())
    print(desc)
EOF
)
        
        echo "- **$tool_name**: $description"
    else
        echo "- **$tool_name**: Game tool"
    fi
done

echo ""
