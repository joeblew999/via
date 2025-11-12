package via

type LogLevel int

const (
	LogLevelError LogLevel = iota
	LogLevelWarn
	LogLevelInfo
	LogLevelDebug
)

// SessionMode determines how session IDs are extracted and managed
type SessionMode int

const (
	// SessionModeCookie uses HTTP cookies only (default, single browser)
	SessionModeCookie SessionMode = iota

	// SessionModeURL uses URL parameter only (shareable URLs, cross-browser)
	SessionModeURL

	// SessionModeBoth tries URL first, falls back to cookie (hybrid)
	SessionModeBoth
)

// String returns human-readable session mode name
func (s SessionMode) String() string {
	switch s {
	case SessionModeCookie:
		return "Cookie"
	case SessionModeURL:
		return "URL"
	case SessionModeBoth:
		return "Cookie + URL"
	default:
		return "Unknown"
	}
}

// Plugin is a func that can mutate the given *via.V app runtime. It is useful to integrate popular JS/CSS UI libraries or tools.
type Plugin func(v *V)

// Config defines configuration options for the via application
type Options struct {
	// The development mode flag. If true, enables server and browser auto-reload on `.go` file changes.
	DevMode bool

	// The http server address. e.g. ':3000'
	ServerAddress string

	// Level of the logs to write to stdout.
	// Options: Error, Warn, Info, Debug.
	LogLvl LogLevel

	// The title of the HTML document.
	DocumentTitle string

	// Plugins to extend the capabilities of the `Via` application.
	Plugins []Plugin

	// Enable session-based state persistence. If true, application state persists across
	// page refreshes and synchronizes across multiple browser tabs.
	// Uses the provided StateStore or defaults to NewMemoryStore().
	StatePersistence bool

	// Custom state store implementation. If nil and StatePersistence is true,
	// uses NewMemoryStore() by default.
	StateStore StateStore

	// SessionMode determines how session IDs are extracted (Cookie, URL, or Both).
	// Default is SessionModeCookie (backward compatible).
	SessionMode SessionMode

	// SessionParamName is the URL parameter name for session ID (default: "sid").
	// Only used when SessionMode is SessionModeURL or SessionModeBoth.
	SessionParamName string
}
