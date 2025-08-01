import subprocess
import threading
import configparser
import signal


from main import DATA_PATH, STATE_PATH

config = configparser.ConfigParser()
config.read(STATE_PATH, encoding="utf-8")
config["status"]["level_won"] = "false"
# Write the updated config back to the file
with open(STATE_PATH, "w", encoding="utf-8") as f:
    config.write(f)

# run setup script
result = subprocess.run("baba_is_eval/setup.sh", cwd=DATA_PATH, shell=True, capture_output=True, text=True)
print(result.stdout)

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



try:
    process.wait()
except KeyboardInterrupt:
    process.send_signal(signal.SIGINT)
    process.wait()
