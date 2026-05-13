#!/usr/bin/env bash
#
# granclaw-dev.sh - GranClaw development environment manager
# FIX 039: Unified dev runtime script
#
# Usage:
#   ./scripts/granclaw-dev.sh start|stop|restart|status|logs
#
# Environment variables:
#   API_PORT - API server port (default: 3001)
#   WEB_PORT - Web server port (default: 5173)
#

set -euo pipefail

# Detect script root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ports
API_PORT="${API_PORT:-3001}"
WEB_PORT="${WEB_PORT:-5173}"

# Runtime directory
RUN_DIR="$ROOT/.run"
API_PID_FILE="$RUN_DIR/granclaw-api.pid"
WEB_PID_FILE="$RUN_DIR/granclaw-web.pid"
API_LOG_FILE="$RUN_DIR/granclaw-api.log"
WEB_LOG_FILE="$RUN_DIR/granclaw-web.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Ensure .run directory exists
ensure_run_dir() {
    mkdir -p "$RUN_DIR"
}

# Kill process by PID file
kill_pid_file() {
    local pid_file="$1"
    local name="$2"

    if [[ -f "$pid_file" ]]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping $name (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            sleep 1
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$pid_file"
    fi
}

# Kill process on port (cross-platform)
kill_port() {
    local port="$1"

    if command -v lsof &>/dev/null; then
        # macOS/Linux with lsof
        local pids
        pids=$(lsof -ti "tcp:$port" 2>/dev/null || true)
        if [[ -n "$pids" ]]; then
            log_warn "Killing processes on port $port: $pids"
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
    elif command -v netstat &>/dev/null && command -v taskkill &>/dev/null; then
        # Windows (Git Bash)
        local pid
        pid=$(netstat -ano 2>/dev/null | grep ":$port " | grep "LISTENING" | awk '{print $5}' | head -1)
        if [[ -n "$pid" && "$pid" != "0" ]]; then
            log_warn "Killing process on port $port: $pid"
            taskkill //F //PID "$pid" 2>/dev/null || true
        fi
    fi
}

# Check if port is in use
port_in_use() {
    local port="$1"

    if command -v lsof &>/dev/null; then
        lsof -ti "tcp:$port" &>/dev/null
    elif command -v netstat &>/dev/null; then
        netstat -ano 2>/dev/null | grep ":$port " | grep -q "LISTENING"
    else
        return 1
    fi
}

# Start services
cmd_start() {
    log_info "Starting GranClaw development environment..."

    cd "$ROOT"
    ensure_run_dir

    # Stop any existing processes
    cmd_stop_quiet

    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        log_info "Installing dependencies..."
        npm install
    fi

    # Start API
    log_info "Starting API on port $API_PORT..."
    npm run dev --workspace=@granclaw/api > "$API_LOG_FILE" 2>&1 &
    local api_pid=$!
    echo "$api_pid" > "$API_PID_FILE"

    # Start Web
    log_info "Starting Web on port $WEB_PORT..."
    npm run dev --workspace=@granclaw/web -- --host 0.0.0.0 > "$WEB_LOG_FILE" 2>&1 &
    local web_pid=$!
    echo "$web_pid" > "$WEB_PID_FILE"

    # Wait for services to start
    log_info "Waiting for services to start..."
    sleep 3

    # Health check
    log_info "Running health check..."
    if curl -sf "http://localhost:$API_PORT/health" > /dev/null 2>&1; then
        log_info "API health check: OK"
    else
        log_warn "API health check: FAILED (may still be starting)"
    fi

    if port_in_use "$WEB_PORT"; then
        log_info "Web server: LISTENING on port $WEB_PORT"
    else
        log_warn "Web server: NOT LISTENING on port $WEB_PORT (may still be starting)"
    fi

    echo ""
    cmd_status

    echo ""
    log_info "GranClaw started!"
    log_info "API: http://localhost:$API_PORT"
    log_info "Web: http://localhost:$WEB_PORT"
    log_info ""
    log_info "Use 'npm run dev:logs' to view logs"
    log_info "Use 'npm run dev:stop' to stop"
}

# Stop services (quiet version for internal use)
cmd_stop_quiet() {
    cd "$ROOT"

    # Kill by PID files
    kill_pid_file "$API_PID_FILE" "API"
    kill_pid_file "$WEB_PID_FILE" "Web"

    # Kill by ports (cleanup orphans)
    kill_port "$API_PORT"
    kill_port "$WEB_PORT"
}

# Stop services
cmd_stop() {
    log_info "Stopping GranClaw development environment..."

    cmd_stop_quiet

    echo ""
    cmd_status

    log_info "GranClaw stopped."
}

# Restart services
cmd_restart() {
    log_info "Restarting GranClaw development environment..."
    cmd_stop
    echo ""
    cmd_start
}

# Show status
cmd_status() {
    echo "=== GranClaw Status ==="
    echo ""

    # API status
    echo -n "API (port $API_PORT): "
    if port_in_use "$API_PORT"; then
        echo -e "${GREEN}UP${NC}"
    else
        echo -e "${RED}DOWN${NC}"
    fi

    if [[ -f "$API_PID_FILE" ]]; then
        echo "  PID file: $API_PID_FILE ($(cat "$API_PID_FILE"))"
    fi
    echo "  Log file: $API_LOG_FILE"

    echo ""

    # Web status
    echo -n "Web (port $WEB_PORT): "
    if port_in_use "$WEB_PORT"; then
        echo -e "${GREEN}UP${NC}"
    else
        echo -e "${RED}DOWN${NC}"
    fi

    if [[ -f "$WEB_PID_FILE" ]]; then
        echo "  PID file: $WEB_PID_FILE ($(cat "$WEB_PID_FILE"))"
    fi
    echo "  Log file: $WEB_LOG_FILE"

    echo ""
}

# Show logs
cmd_logs() {
    ensure_run_dir

    echo "=== GranClaw Logs (last 60 lines each) ==="
    echo ""

    if [[ -f "$API_LOG_FILE" ]]; then
        echo "--- API Log ($API_LOG_FILE) ---"
        tail -n 60 "$API_LOG_FILE" 2>/dev/null || echo "(empty)"
        echo ""
    else
        echo "--- API Log: not found ---"
        echo ""
    fi

    if [[ -f "$WEB_LOG_FILE" ]]; then
        echo "--- Web Log ($WEB_LOG_FILE) ---"
        tail -n 60 "$WEB_LOG_FILE" 2>/dev/null || echo "(empty)"
        echo ""
    else
        echo "--- Web Log: not found ---"
        echo ""
    fi
}

# Show usage
usage() {
    echo "Usage: $0 {start|stop|restart|status|logs}"
    echo ""
    echo "Commands:"
    echo "  start   - Start API and Web servers"
    echo "  stop    - Stop all servers"
    echo "  restart - Restart all servers"
    echo "  status  - Show server status"
    echo "  logs    - Show last 60 lines of logs"
    echo ""
    echo "Environment variables:"
    echo "  API_PORT - API server port (default: 3001)"
    echo "  WEB_PORT - Web server port (default: 5173)"
}

# Main
case "${1:-}" in
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    status)
        cmd_status
        ;;
    logs)
        cmd_logs
        ;;
    *)
        usage
        exit 1
        ;;
esac
