#!/bin/bash

# Setup script for Baba Is Agent
# This script sets up the environment for running the Baba Is You AI agent

set -e

echo "================================"
echo "Baba Is Agent - Setup"
echo "================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on macOS or Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    GAME_DIR="$HOME/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    GAME_DIR="$HOME/.local/share/Steam/steamapps/common/Baba Is You"
else
    echo -e "${RED}Error: Unsupported operating system. This script supports macOS and Linux.${NC}"
    exit 1
fi

echo "Detected OS: $OS"
echo

# Check for Node.js
echo "Checking for Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed. Please install Node.js first.${NC}"
    echo "Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js found: $NODE_VERSION${NC}"

# Check for npm
echo "Checking for npm..."
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed. Please install npm first.${NC}"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo -e "${GREEN}✓ npm found: $NPM_VERSION${NC}"

# Check for Python
echo "Checking for Python..."
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo -e "${RED}Error: Python is not installed. Please install Python 3 first.${NC}"
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD --version)
echo -e "${GREEN}✓ Python found: $PYTHON_VERSION${NC}"

# Check for OpenCode
echo "Checking for OpenCode..."
if ! command -v opencode &> /dev/null; then
    echo -e "${YELLOW}⚠ OpenCode not found. Installing...${NC}"
    curl -fsSL https://opencode.ai/install.sh | sh
    echo -e "${GREEN}✓ OpenCode installed${NC}"
else
    OPENCODE_VERSION=$(opencode --version)
    echo -e "${GREEN}✓ OpenCode found: $OPENCODE_VERSION${NC}"
fi

echo

# Setup Python environment
echo "Setting up Python environment..."
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv .venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
fi

echo "Activating virtual environment..."
source .venv/bin/activate

echo "Installing Python dependencies..."
pip install -q pyautogui

echo -e "${GREEN}✓ Python dependencies installed${NC}"

# Setup Node.js dependencies
echo
echo "Setting up Node.js dependencies..."
cd .opencode
if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install
    echo -e "${GREEN}✓ Node.js dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Node.js dependencies already installed${NC}"
fi
cd ..

# Check for Baba Is You installation
echo
echo "Checking for Baba Is You installation..."
if [ -d "$GAME_DIR" ]; then
    echo -e "${GREEN}✓ Baba Is You found at:${NC}"
    echo "  $GAME_DIR"
else
    echo -e "${YELLOW}⚠ Baba Is You installation not found at expected location:${NC}"
    echo "  $GAME_DIR"
    echo "Please ensure Baba Is You is installed via Steam."
fi

# Install Lua mod
echo
echo "Installing Lua mod (io.lua)..."
LUA_SOURCE="$(pwd)/lua/io.lua"
LUA_DEST="$GAME_DIR/baba_is_eval/io.lua"

if [ -f "$LUA_SOURCE" ]; then
    # Create baba_is_eval directory if it doesn't exist
    mkdir -p "$GAME_DIR/baba_is_eval"
    
    # Backup existing io.lua if it exists
    if [ -f "$LUA_DEST" ]; then
        echo "Backing up existing io.lua..."
        cp "$LUA_DEST" "$LUA_DEST.backup.$(date +%Y%m%d%H%M%S)"
    fi
    
    # Copy io.lua
    cp "$LUA_SOURCE" "$LUA_DEST"
    echo -e "${GREEN}✓ Lua mod installed${NC}"
    echo "  From: $LUA_SOURCE"
    echo "  To: $LUA_DEST"
else
    echo -e "${RED}Error: io.lua not found at $LUA_SOURCE${NC}"
    exit 1
fi

# Create commands directory
COMMANDS_DIR="$GAME_DIR/baba_is_eval/commands"
if [ ! -d "$COMMANDS_DIR" ]; then
    mkdir -p "$COMMANDS_DIR"
    echo -e "${GREEN}✓ Created commands directory${NC}"
fi

echo
echo "================================"
echo -e "${GREEN}Setup complete!${NC}"
echo "================================"
echo
echo "Next steps:"
echo "1. Start Baba Is You game"
echo "2. Enable the io.lua mod in the game's mod menu"
echo "3. Run: opencode run 'solve the level' --agent baba"
echo
echo "For testing:"
echo "  cd .opencode && npx tsx tests/capture_state.ts"
echo "  cd .opencode && npx tsx tests/test_tools.ts"
echo
