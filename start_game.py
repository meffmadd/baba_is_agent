import subprocess
import threading
import os

from main import DATA_PATH


# delete previous commands
commands = DATA_PATH / "baba_is_eval" / "commands"
files = commands.glob("*.lua")
for cmd in files:
   os.remove(cmd)

def stream_output(pipe):
    """Reads lines from subprocess pipe and writes to stdout."""
    for line in iter(pipe.readline, ''):
        print(line, end='')  # Already includes newline
    pipe.close()

# Start the game as a subprocess
process = subprocess.Popen(
    ["../../MacOS/Chowdren"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
    cwd=DATA_PATH
)

# Start a background thread to stream output
thread = threading.Thread(target=stream_output, args=(process.stdout,))
thread.daemon = True  # Optional: stops with main program
thread.start()

process.wait()
