#!/bin/bash
set -e

# Browser automation script for multi-window side-by-side testing
# Opens 2 browser windows positioned side-by-side with the same URL
# Kills existing browser instances to avoid race conditions
#
# Usage: ./test-browser.sh [safari|chrome|firefox] [URL]

BROWSER="${1:-safari}"
URL="${2:-https://localhost:3443}"

echo "🧪 Browser Test Automation"
echo "Browser: $BROWSER"
echo "URL: $URL"
echo ""

# Get screen dimensions dynamically
get_screen_bounds() {
    BOUNDS=$(osascript -e 'tell application "Finder" to get bounds of window of desktop')
    SCREEN_WIDTH=$(echo "$BOUNDS" | awk -F', ' '{print $3}')
    SCREEN_HEIGHT=$(echo "$BOUNDS" | awk -F', ' '{print $4}')
    HALF_WIDTH=$((SCREEN_WIDTH / 2))

    echo "📐 Screen: ${SCREEN_WIDTH}x${SCREEN_HEIGHT}"
    echo "📏 Window size: ${HALF_WIDTH}x${SCREEN_HEIGHT}"
    echo ""
}

# Safari implementation - most reliable
launch_safari() {
    echo "🦁 Launching Safari..."

    # Quit Safari completely to avoid race conditions
    osascript -e 'tell application "Safari" to quit' 2>/dev/null || true
    sleep 1

    # Open 2 windows side-by-side
    osascript <<EOF
tell application "Safari"
    activate

    -- First window (left half)
    make new document with properties {URL:"$URL"}
    set bounds of window 1 to {0, 50, $HALF_WIDTH, $SCREEN_HEIGHT}

    -- Wait briefly for window to be created
    delay 0.5

    -- Second window (right half)
    make new document with properties {URL:"$URL"}
    set bounds of window 2 to {$HALF_WIDTH, 50, $SCREEN_WIDTH, $SCREEN_HEIGHT}
end tell
EOF

    echo "✅ Safari: 2 windows opened side-by-side"
}

# Chrome implementation
launch_chrome() {
    echo "🌐 Launching Chrome..."

    # Quit Chrome completely to avoid race conditions
    osascript -e 'tell application "Google Chrome" to quit' 2>/dev/null || true

    # Force kill any remaining Chrome processes
    pkill -x "Google Chrome" 2>/dev/null || true
    sleep 3

    # Open 2 windows side-by-side - using a simpler approach
    osascript <<EOF
tell application "Google Chrome"
    -- First window (left half)
    make new window
    set URL of active tab of window 1 to "$URL"
    set bounds of window 1 to {0, 50, $HALF_WIDTH, $SCREEN_HEIGHT}

    delay 0.5

    -- Second window (right half)
    make new window
    set URL of active tab of window 1 to "$URL"
    set bounds of window 1 to {$HALF_WIDTH, 50, $SCREEN_WIDTH, $SCREEN_HEIGHT}

    delay 0.3

    -- Now close any extra windows (keep only our 2)
    repeat while (count of windows) > 2
        try
            -- Find and close windows that aren't our test windows
            repeat with i from (count of windows) to 1 by -1
                set w to window i
                if (count of tabs of w) = 1 then
                    set tabURL to URL of active tab of w
                    if tabURL is not equal to "$URL" then
                        close w
                        exit repeat
                    end if
                end if
            end repeat
        end try
    end repeat
end tell
EOF

    echo "✅ Chrome: 2 windows opened side-by-side"
}

# Firefox implementation - requires Accessibility permissions
launch_firefox() {
    echo "🦊 Launching Firefox..."

    # Quit Firefox completely
    osascript -e 'tell application "Firefox" to quit' 2>/dev/null || true
    sleep 2

    # Check if Firefox exists
    if [ ! -f "/Applications/Firefox.app/Contents/MacOS/firefox" ]; then
        echo "❌ Firefox not found at /Applications/Firefox.app"
        echo "   Please install Firefox or update the path in this script"
        exit 1
    fi

    # Open first window (left half)
    /Applications/Firefox.app/Contents/MacOS/firefox -new-window "$URL" &
    sleep 3

    # Position first window using System Events
    osascript <<EOF
tell application "System Events"
    tell process "Firefox"
        set position of window 1 to {0, 50}
        set size of window 1 to {$HALF_WIDTH, $((SCREEN_HEIGHT - 50))}
    end tell
end tell
EOF

    sleep 1

    # Open second window (right half)
    /Applications/Firefox.app/Contents/MacOS/firefox -new-window "$URL" &
    sleep 3

    # Position second window
    osascript <<EOF
tell application "System Events"
    tell process "Firefox"
        set position of window 2 to {$HALF_WIDTH, 50}
        set size of window 2 to {$HALF_WIDTH, $((SCREEN_HEIGHT - 50))}
    end tell
end tell
EOF

    echo "✅ Firefox: 2 windows opened side-by-side"
    echo ""
    echo "⚠️  Note: Firefox requires Accessibility permissions"
    echo "   System Preferences > Security & Privacy > Privacy > Accessibility"
}

# Main execution
get_screen_bounds

case "$BROWSER" in
    safari)
        launch_safari
        ;;
    chrome)
        launch_chrome
        ;;
    firefox)
        launch_firefox
        ;;
    *)
        echo "❌ Unknown browser: $BROWSER"
        echo ""
        echo "Usage: $0 [safari|chrome|firefox] [URL]"
        echo ""
        echo "Examples:"
        echo "  $0 safari https://192.168.1.100:3443"
        echo "  $0 chrome https://localhost:3443"
        echo "  $0 firefox https://192.168.1.100:3443"
        exit 1
        ;;
esac

echo ""
echo "🎉 Ready to test multi-window sync!"
echo "   - Click increment in left window → should update right window"
echo "   - Click increment in right window → should update left window"
echo "   - Refresh one window → sync should still work immediately"
