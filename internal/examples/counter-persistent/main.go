package main

import (
	"flag"
	"fmt"
	"net"

	"github.com/go-via/via"
	"github.com/go-via/via/h"
)

var (
	port = flag.String("port", "3000", "Server port")
)

func main() {
	flag.Parse()

	v := via.New()

	// Enable state persistence - this is the key feature!
	v.Config(via.Options{
		StatePersistence: true,              // Persist state across page refreshes
		LogLvl:           via.LogLevelDebug, // Enable debug logging
		ServerAddress:    ":" + *port,
	})

	v.Page("/", func(c *via.Context) {
		// For multi-tab sync, read state in the view function, not as a closure variable

		increment := c.Action(func() {
			// Read current count, increment, and save
			count := c.StateInt("count", 0)
			count++
			c.SetState("count", count)
			c.Sync()
		})

		decrement := c.Action(func() {
			count := c.StateInt("count", 0)
			count--
			c.SetState("count", count)
			c.Sync()
		})

		reset := c.Action(func() {
			c.SetState("count", 0)
			c.Sync()
		})

		c.View(func() h.H {
			// Read count from state in the view - this enables multi-tab sync!
			count := c.StateInt("count", 0)
			cfg := c.GetApp().GetConfig()

			return h.Div(
				h.H1(h.Text("Persistent Counter")),
				h.P(h.Text("This counter persists across page refreshes and syncs across multiple browser tabs!")),

				// Debug Info Section
				h.Hr(),
				h.Div(
					h.ID("debug-info"),
					h.Style("background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 5px; font-family: monospace; font-size: 12px;"),
					h.Strong(h.Text("🔍 Debug Info:")),
					h.Br(),
					h.Span(h.Attr("data-session-mode", cfg.SessionMode.String()), h.Text("Session Mode: "), h.Code(h.Text(cfg.SessionMode.String()))),
					h.Br(),
					h.Span(h.Attr("data-session-id", c.GetSessionID()), h.Text("Session ID: "), h.Code(h.Text(c.GetSessionID()))),
					h.Br(),
					h.Span(h.Attr("data-session-source", string(c.GetSessionSource())), h.Text("Session Source: "), h.Code(h.Text(string(c.GetSessionSource())))),
					h.Br(),
					h.Text("Context ID: "), h.Code(h.Text(c.GetID())),
					h.Br(),
					h.Text("State Store: MemoryStore (in-process pub/sub)"),
				),

				// Counter Display
				h.Hr(),
				h.H2(h.Textf("Count: %d", count)),
				h.Br(),
				h.Button(h.Text("➕ Increment"), increment.OnClick()),
				h.Text(" "),
				h.Button(h.Text("➖ Decrement"), decrement.OnClick()),
				h.Text(" "),
				h.Button(h.Text("🔄 Reset"), reset.OnClick()),

				// Instructions
				h.Hr(),
				h.H3(h.Text("Try This:")),
				h.Ul(
					h.Li(h.Text("Click increment a few times")),
					h.Li(h.Text("Refresh the page → count persists!")),
					h.Li(h.Text("Open this page in another tab → both tabs show same count")),
					h.Li(h.Text("Click increment in one tab → other tab updates automatically!")),
				),

				// Safari Multi-Tab Sync Notes
				h.Hr(),
				h.Div(
					h.Style("background: #fff3cd; padding: 10px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #ffc107;"),
					h.H3(h.Text("🦁 Safari Multi-Tab Sync:")),
					h.Ul(
						h.Li(h.Text("✅ Session IDs must be the SAME in both tabs")),
						h.Li(h.Text("✅ Context IDs will be DIFFERENT (this is normal)")),
						h.Li(h.Strong(h.Text("⚠️  IMPORTANT: Keep both tabs VISIBLE side-by-side!"))),
						h.Li(h.Text("❌ Safari suspends background tabs - they won't receive live updates")),
						h.Li(h.Text("💡 Solution: Arrange tabs side-by-side or use separate windows")),
						h.Li(h.Text("🔄 Background tabs WILL sync when you switch back to them")),
					),
				),
			)
		})
	})

	// Print network URLs before starting
	printNetworkURLs(*port)

	v.Start()
}

// printNetworkURLs displays localhost and LAN IP URLs
func printNetworkURLs(port string) {
	fmt.Println("\n" + "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Printf("  🔒 Via Backend (proxied via Caddy)\n")
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Printf("  Backend: http://localhost:%s (internal)\n", port)
	fmt.Println()
	fmt.Printf("  Access via HTTPS:\n")
	fmt.Printf("  Local:   https://localhost:3443\n")

	// Get LAN IP
	if lanIP := getLANIP(); lanIP != "" {
		fmt.Printf("  Network: https://%s:3443  📱\n", lanIP)
	}
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
}

// getLANIP returns the local network IP address
func getLANIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ""
	}

	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String()
			}
		}
	}
	return ""
}
