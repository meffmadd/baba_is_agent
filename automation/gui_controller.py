#!/usr/bin/env python3
"""
GUI controller for Baba Is You automation.
Handles window management and startup interactions using osascript and pyautogui.
"""

import subprocess
import time
from typing import Optional, Tuple
import pyautogui

# Safety and timing for pyautogui
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.5

_GAME_PROCESS_NAME: Optional[str] = None
_VERBOSE = False


def set_verbose(verbose: bool = True):
    """Enable or disable verbose logging."""
    global _VERBOSE
    _VERBOSE = verbose


def _log(message: str):
    """Log message if verbose mode is enabled."""
    if _VERBOSE:
        print(f"[GUI] {message}")


def reset_game_process_name():
    """Reset the cached game process name. Call after killing the game."""
    global _GAME_PROCESS_NAME
    _GAME_PROCESS_NAME = None
    _log("Reset cached game process name")


def get_game_process_name() -> Optional[str]:
    """Detect the game process name (Baba Is You or Chowdren).

    Returns:
        The process name if found, None otherwise
    """
    global _GAME_PROCESS_NAME

    if _GAME_PROCESS_NAME is not None:
        _log(f"Using cached process name: {_GAME_PROCESS_NAME}")
        return _GAME_PROCESS_NAME

    script = """
    tell application "System Events"
        set processNames to name of every process
        if processNames contains "Baba Is You" then
            return "Baba Is You"
        else if processNames contains "Chowdren" then
            return "Chowdren"
        else
            return ""
        end if
    end tell
    """
    try:
        result = subprocess.run(
            ["osascript", "-e", script], capture_output=True, text=True, timeout=5
        )
        name = result.stdout.strip()
        if name:
            _GAME_PROCESS_NAME = name
            _log(f"Detected game process name: {name}")
            return _GAME_PROCESS_NAME
        else:
            _log("No game process found")
    except (subprocess.TimeoutExpired, subprocess.SubprocessError) as e:
        _log(f"Error detecting game process: {e}")
    return None


def find_game_window() -> bool:
    """Check if game window exists using osascript.

    Returns:
        True if window found, False otherwise
    """
    return get_game_process_name() is not None


def get_window_position() -> Optional[Tuple[int, int]]:
    """Get the top-left position of the game window.

    Returns:
        Tuple of (x, y) coordinates, or None if window not found
    """
    process_name = get_game_process_name()
    if not process_name:
        return None

    script = f"""
    tell application "System Events"
        tell process "{process_name}"
            set frontWindow to window 1
            return position of frontWindow
        end tell
    end tell
    """
    try:
        result = subprocess.run(
            ["osascript", "-e", script], capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            # Parse "{x, y}" format
            coords = result.stdout.strip().strip("{}").split(", ")
            return (int(coords[0]), int(coords[1]))
    except (
        subprocess.TimeoutExpired,
        subprocess.SubprocessError,
        ValueError,
        IndexError,
    ):
        pass
    return None


def position_window(x: int, y: int, width: int, height: int) -> bool:
    """Position game window using osascript.

    Args:
        x: Left edge position
        y: Top edge position
        width: Window width
        height: Window height

    Returns:
        True if successful, False otherwise
    """
    process_name = get_game_process_name()
    if not process_name:
        _log("Failed to position window: no game process found")
        return False

    script = f"""
    tell application "System Events"
        tell process "{process_name}"
            set position of window 1 to {{{x}, {y}}}
            set size of window 1 to {{{width}, {height}}}
        end tell
    end tell
    """
    try:
        result = subprocess.run(
            ["osascript", "-e", script], capture_output=True, text=True, timeout=5
        )
        success = result.returncode == 0
        if success:
            _log(f"Positioned window to ({x}, {y}) size {width}x{height}")
        else:
            _log(
                f"Failed to position window: osascript returned {result.returncode}, stderr: {result.stderr}"
            )
        return success
    except (subprocess.TimeoutExpired, subprocess.SubprocessError) as e:
        _log(f"Failed to position window: {e}")
        return False


def wait_for_window(timeout: int = 30) -> bool:
    """Poll for game window until it appears.

    Args:
        timeout: Maximum seconds to wait

    Returns:
        True if window found, False on timeout
    """
    _log(f"Waiting for game window (timeout: {timeout}s)...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        if find_game_window():
            _log("Game window detected")
            return True
        time.sleep(1)
    _log(f"Timed out waiting for game window after {timeout}s")
    return False


# ========== Pyautogui-based functions ==========


def focus_game_pyautogui(x: int, y: int) -> bool:
    """Focus game window by clicking at absolute screen coordinates.

    Args:
        x: X coordinate on screen
        y: Y coordinate on screen

    Returns:
        True if click executed successfully, False otherwise
    """
    try:
        pyautogui.click(x, y)
        _log(f"Focused game window by clicking at ({x}, {y})")
        time.sleep(0.2)
        return True
    except Exception as e:
        _log(f"Failed to focus game with pyautogui click: {e}")
        return False


def press_key_pyautogui(
    key: str, delay: float = 0.5, hold_duration: float = 0.0
) -> bool:
    """Press a key using pyautogui.

    Args:
        key: Key to press (e.g., "enter", "escape", "up", "down", "left", "right")
        delay: Seconds to wait after the press (in addition to pyautogui.PAUSE)
        hold_duration: Seconds to hold the key down (0 for instant press)

    Returns:
        True if press executed successfully, False otherwise
    """
    try:
        if hold_duration > 0:
            with pyautogui.hold(key):
                time.sleep(hold_duration)
            _log(
                f"Held key '{key}' for {hold_duration}s using pyautogui, waiting additional {delay}s"
            )
        else:
            pyautogui.press(key)
            _log(f"Pressed key '{key}' using pyautogui, waiting additional {delay}s")
        time.sleep(delay)
        return True
    except Exception as e:
        _log(f"Failed to press key '{key}' with pyautogui: {e}")
        return False


def press_key_multiple(key: str, count: int, interval: float = 0.5) -> bool:
    """Press a key multiple times using pyautogui.

    Args:
        key: Key to press (e.g., "enter", "escape", "up", "down", "left", "right")
        count: Number of times to press the key
        interval: Seconds between presses (overrides pyautogui.PAUSE for just this call)

    Returns:
        True if all presses executed successfully, False otherwise
    """
    try:
        pyautogui.press(key, presses=count, interval=interval)
        _log(f"Pressed key '{key}' {count} times with {interval}s interval")
        return True
    except Exception as e:
        _log(f"Failed to press key '{key}' {count} times with pyautogui: {e}")
        return False


# ========== Legacy osascript-based functions (deprecated but kept for reference) ==========


def focus_game() -> bool:
    """Focus the game window by clicking near its center (osascript version - deprecated).

    Returns:
        True if successful, False otherwise
    """
    _log("WARNING: focus_game() is deprecated, use focus_game_pyautogui()")
    process_name = get_game_process_name()
    if not process_name:
        _log("Failed to focus game: no game process found")
        return False

    script = f"""
    tell application "System Events"
        tell process "{process_name}"
            set frontWindow to window 1
            set windowPos to position of frontWindow
            set windowSize to size of frontWindow
            set clickX to (item 1 of windowPos) + (item 1 of windowSize) / 2
            set clickY to (item 2 of windowPos) + (item 2 of windowSize) / 2
            click at {{clickX, clickY}}
        end tell
    end tell
    """
    try:
        result = subprocess.run(
            ["osascript", "-e", script], capture_output=True, text=True, timeout=5
        )
        success = result.returncode == 0
        if success:
            _log("Focused game window (osascript version)")
        else:
            _log(
                f"Failed to focus game: osascript returned {result.returncode}, stderr: {result.stderr}"
            )
        return success
    except (subprocess.TimeoutExpired, subprocess.SubprocessError) as e:
        _log(f"Failed to focus game: {e}")
        return False


def press_key(key: str) -> bool:
    """Press a key using osascript (deprecated - use press_key_pyautogui instead)."""
    _log(f"WARNING: press_key() is deprecated, use press_key_pyautogui()")
    process_name = get_game_process_name()
    if not process_name:
        _log(f"Failed to press key '{key}': no game process found")
        return False

    script = f"""
    tell application "System Events"
        tell process "{process_name}"
            keystroke {key}
        end tell
    end tell
    """
    try:
        result = subprocess.run(
            ["osascript", "-e", script], capture_output=True, text=True, timeout=5
        )
        success = result.returncode == 0
        if success:
            _log(f"Pressed key '{key}' (osascript version)")
        else:
            _log(
                f"Failed to press key '{key}': osascript returned {result.returncode}, stderr: {result.stderr}"
            )
        return success
    except (subprocess.TimeoutExpired, subprocess.SubprocessError) as e:
        _log(f"Failed to press key '{key}': {e}")
        return False


def press_key_code(key_code: int) -> bool:
    """Press a key by key code using osascript (deprecated - use press_key_pyautogui instead)."""
    _log(f"WARNING: press_key_code() is deprecated, use press_key_pyautogui()")
    process_name = get_game_process_name()
    if not process_name:
        _log(f"Failed to press key code {key_code}: no game process found")
        return False

    script = f"""
    tell application "System Events"
        tell process "{process_name}"
            key code {key_code}
        end tell
    end tell
    """
    try:
        result = subprocess.run(
            ["osascript", "-e", script], capture_output=True, text=True, timeout=5
        )
        success = result.returncode == 0
        if success:
            _log(f"Pressed key code {key_code} (osascript version)")
        else:
            _log(
                f"Failed to press key code {key_code}: osascript returned {result.returncode}, stderr: {result.stderr}"
            )
        return success
    except (subprocess.TimeoutExpired, subprocess.SubprocessError) as e:
        _log(f"Failed to press key code {key_code}: {e}")
        return False


# Key codes for common keys (reference for osascript version)
KEY_CODES = {
    "enter": 36,
    "escape": 53,
    "up": 126,
    "down": 125,
    "left": 123,
    "right": 124,
}
