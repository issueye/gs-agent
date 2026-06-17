// Performance harness for gs-llm-bridge.
//
// It starts a native Go mock upstream, provisions the bridge (provider, model,
// routing rule, api key) through the management API, then drives concurrent
// load against the real proxy paths and reports p50/p95/p99 latency and rps.
//
// Usage:
//
//	perf.exe -bridge http://127.0.0.1:18181 -duration 10s -concurrency 1,10,50,100
//
// The mock upstream intentionally returns fixed, small JSON bodies so the
// measured latency reflects bridge work (routing, conversion, store traffic
// writes, SSE handling) rather than upstream generation time.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ---------- mock upstream ----------

// mockUpstream serves OpenAI Chat Completions and Anthropic Messages shapes.
// It mirrors what a real upstream would return so the bridge's converters run
// their real path. Streams are also handled so streaming proxy perf is real.
type mockUpstream struct {
	server *http.Server
	addr   string
	hits   atomic.Int64
}

func newMockUpstream() (*mockUpstream, error) {
	mux := http.NewServeMux()
	m := &mockUpstream{}

	mux.HandleFunc("/v1/chat/completions", func(w http.ResponseWriter, r *http.Request) {
		m.hits.Add(1)
		body, _ := io.ReadAll(r.Body)
		var req struct {
			Model    string `json:"model"`
			Stream   bool   `json:"stream"`
			Messages []struct {
				Content interface{} `json:"content"`
			} `json:"messages"`
		}
		_ = json.Unmarshal(body, &req)

		// prompt token estimate from message text length
		prompt := 0
		for _, msg := range req.Messages {
			switch c := msg.Content.(type) {
			case string:
				prompt += len(c)
			}
		}

		if req.Stream {
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			flusher, _ := w.(http.Flusher)
			// one delta chunk + a usage-bearing final chunk
			fmt.Fprintf(w, "data: {\"id\":\"chatcmpl-mock\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"%s\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"hi\"},\"finish_reason\":null}]}\n\n", req.Model)
			if flusher != nil {
				flusher.Flush()
			}
			fmt.Fprintf(w, "data: {\"id\":\"chatcmpl-mock\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"%s\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":%d,\"completion_tokens\":1,\"total_tokens\":%d}}\n\n", req.Model, prompt, prompt+1)
			if flusher != nil {
				flusher.Flush()
			}
			fmt.Fprint(w, "data: [DONE]\n\n")
			if flusher != nil {
				flusher.Flush()
			}
			return
		}

		w.Header().Set("Content-Type", "application/json")
		resp := map[string]interface{}{
			"id":      "chatcmpl-mock",
			"object":  "chat.completion",
			"created": 1,
			"model":   req.Model,
			"choices": []map[string]interface{}{{
				"index":         0,
				"message":       map[string]interface{}{"role": "assistant", "content": "mock response"},
				"finish_reason": "stop",
			}},
			"usage": map[string]int{"prompt_tokens": prompt, "completion_tokens": 1, "total_tokens": prompt + 1},
		}
		_ = json.NewEncoder(w).Encode(resp)
	})

	mux.HandleFunc("/v1/messages", func(w http.ResponseWriter, r *http.Request) {
		m.hits.Add(1)
		body, _ := io.ReadAll(r.Body)
		var req struct {
			Model    string `json:"model"`
			Stream   bool   `json:"stream"`
			System   interface{} `json:"system"`
			Messages []struct {
				Content interface{} `json:"content"`
			} `json:"messages"`
		}
		_ = json.Unmarshal(body, &req)

		input := 0
		for _, msg := range req.Messages {
			switch c := msg.Content.(type) {
			case string:
				input += len(c)
			}
		}

		if req.Stream {
			w.Header().Set("Content-Type", "text/event-stream")
			flusher, _ := w.(http.Flusher)
			fmt.Fprintf(w, "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_mock\",\"model\":\"%s\",\"usage\":{\"input_tokens\":%d,\"output_tokens\":0}}}\n\n", req.Model, input)
			if flusher != nil {
				flusher.Flush()
			}
			fmt.Fprintf(w, "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"hi\"}}\n\n")
			if flusher != nil {
				flusher.Flush()
			}
			fmt.Fprintf(w, "event: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\"},\"usage\":{\"output_tokens\":1}}\n\n")
			if flusher != nil {
				flusher.Flush()
			}
			fmt.Fprint(w, "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n")
			if flusher != nil {
				flusher.Flush()
			}
			return
		}

		w.Header().Set("Content-Type", "application/json")
		resp := map[string]interface{}{
			"id":            "msg_mock",
			"type":          "message",
			"role":          "assistant",
			"model":         req.Model,
			"content":       []map[string]string{{"type": "text", "text": "mock response"}},
			"stop_reason":   "end_turn",
			"stop_sequence": nil,
			"usage":         map[string]int{"input_tokens": input, "output_tokens": 1},
		}
		_ = json.NewEncoder(w).Encode(resp)
	})

	srv := &http.Server{Handler: mux}
	m.server = srv
	ln, err := newListener()
	if err != nil {
		return nil, err
	}
	m.addr = ln.Addr().String()
	go func() { _ = srv.Serve(ln) }()
	return m, nil
}

func (m *mockUpstream) baseURL() string { return "http://" + m.addr }
func (m *mockUpstream) close()          { _ = m.server.Close() }

func newListener() (net.Listener, error) {
	return net.Listen("tcp", "127.0.0.1:0")
}

// ---------- result stats ----------

type stats struct {
	count     int
	failures  int
	durations []time.Duration
	totalMS   float64
	errSamples []string
}

func (s *stats) add(d time.Duration, ok bool) {
	s.count++
	if !ok {
		s.failures++
	}
	s.durations = append(s.durations, d)
	s.totalMS += float64(d.Microseconds()) / 1000.0
}

func (s *stats) addErrSample(msg string) {
	if len(s.errSamples) < 3 {
		s.errSamples = append(s.errSamples, msg)
	}
}

func (s *stats) percentile(p float64) time.Duration {
	if len(s.durations) == 0 {
		return 0
	}
	sort.Slice(s.durations, func(i, j int) bool { return s.durations[i] < s.durations[j] })
	idx := int(math.Ceil(p/100*float64(len(s.durations)))) - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(s.durations) {
		idx = len(s.durations) - 1
	}
	return s.durations[idx]
}

// ---------- bridge provisioning ----------

func provision(bridge, upstreamURL, apiKey string) error {
	post := func(path string, body interface{}) error {
		buf, _ := json.Marshal(body)
		req, _ := http.NewRequest("POST", bridge+path, bytes.NewReader(buf))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 300 {
			b, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("provision %s: status %d body %s", path, resp.StatusCode, string(b))
		}
		io.Copy(io.Discard, resp.Body)
		return nil
	}

	if err := post("/api/v1/providers", map[string]interface{}{
		"id": "perf-openai", "name": "Perf OpenAI", "protocol": "openai_chat",
		"vendor": "openai", "base_url": upstreamURL, "enabled": true,
	}); err != nil {
		return err
	}
	if err := post("/api/v1/providers/perf-openai/models", map[string]interface{}{
		"id": "perf-model", "name": "perf-model", "max_tokens": 32768, "enabled": true,
	}); err != nil {
		return err
	}
	// default rule for openai_chat downstream
	if err := post("/api/v1/routing-rules", map[string]interface{}{
		"id": "perf-rule-chat", "name": "Perf Chat", "priority": 100,
		"match_protocol": "openai_chat", "match_model_pattern": "*",
		"upstream_protocol": "openai_chat", "target_provider_id": "perf-openai",
		"target_model": "perf-model", "enabled": true,
	}); err != nil {
		return err
	}
	// rule routing openai_chat downstream to an anthropic upstream (conversion path)
	if err := post("/api/v1/providers", map[string]interface{}{
		"id": "perf-anthropic", "name": "Perf Anthropic", "protocol": "anthropic",
		"vendor": "anthropic", "base_url": upstreamURL, "enabled": true,
	}); err != nil {
		return err
	}
	if err := post("/api/v1/providers/perf-anthropic/models", map[string]interface{}{
		"id": "perf-model", "name": "perf-model", "max_tokens": 32768, "enabled": true,
	}); err != nil {
		return err
	}
	if err := post("/api/v1/routing-rules", map[string]interface{}{
		"id": "perf-rule-conv", "name": "Perf Conversion", "priority": 200,
		"match_protocol": "openai_chat", "match_model_pattern": "conv-*",
		"upstream_protocol": "anthropic", "target_provider_id": "perf-anthropic",
		"target_model": "perf-model", "enabled": true,
	}); err != nil {
		return err
	}
	return nil
}

// ---------- benchmark runner ----------

type scenario struct {
	name   string
	method string
	path   string
	body   interface{}
	auth   bool
}

func runScenario(bridge, apiKey string, sc scenario, concurrency int, duration time.Duration) *stats {
	buf, _ := json.Marshal(sc.body)
	bodyBytes := buf

	s := &stats{}
	var wg sync.WaitGroup
	stop := make(chan struct{})
	time.AfterFunc(duration, func() { close(stop) })

	// Reuse TCP connections via a shared transport to avoid ephemeral-port
	// exhaustion (Windows WSAEADDRINUSE) under high request churn.
	transport := &http.Transport{
		MaxIdleConns:        concurrency * 2,
		MaxIdleConnsPerHost: concurrency * 2,
		MaxConnsPerHost:     0,
		IdleConnTimeout:     90 * time.Second,
	}
	client := &http.Client{Timeout: 30 * time.Second, Transport: transport}
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-stop:
					return
				default:
				}
				req, _ := http.NewRequest(sc.method, bridge+sc.path, bytes.NewReader(bodyBytes))
				req.Header.Set("Content-Type", "application/json")
				if sc.auth {
					req.Header.Set("Authorization", "Bearer "+apiKey)
				}
				start := time.Now()
				resp, err := client.Do(req)
				if err != nil {
					s.add(time.Since(start), false)
					s.addErrSample("ERR " + err.Error())
					continue
				}
				var rb []byte
				if resp.StatusCode >= 300 {
					rb, _ = io.ReadAll(resp.Body)
				} else {
					io.Copy(io.Discard, resp.Body)
				}
				resp.Body.Close()
				ok := resp.StatusCode >= 200 && resp.StatusCode < 300
				s.add(time.Since(start), ok)
				if !ok {
					s.addErrSample(fmt.Sprintf("status=%d body=%s", resp.StatusCode, string(rb)))
				}
			}
		}()
	}
	wg.Wait()
	return s
}

func report(name string, s *stats, elapsed time.Duration) {
	rps := float64(s.count) / elapsed.Seconds()
	if s.count == 0 {
		fmt.Printf("  %-40s  no samples\n", name)
		return
	}
	fmt.Printf("  %-40s  rps=%8.1f  n=%-6d  fail=%-4d  p50=%-8s  p95=%-8s  p99=%-8s  max=%s\n",
		name, rps, s.count, s.failures,
		roundDur(s.percentile(50)), roundDur(s.percentile(95)),
		roundDur(s.percentile(99)), roundDur(s.durations[len(s.durations)-1]))
	for _, e := range s.errSamples {
		fmt.Printf("      ! %s\n", e)
	}
}

func roundDur(d time.Duration) string {
	switch {
	case d < time.Microsecond:
		return fmt.Sprintf("%dns", d.Nanoseconds())
	case d < time.Millisecond:
		return fmt.Sprintf("%.1fµs", float64(d.Nanoseconds())/1000)
	default:
		return fmt.Sprintf("%.2fms", float64(d.Microseconds())/1000)
	}
}

func parseConcurrencyList(s string) []int {
	out := []int{}
	for _, part := range strings.Split(s, ",") {
		n, err := strconv.Atoi(strings.TrimSpace(part))
		if err == nil && n > 0 {
			out = append(out, n)
		}
	}
	return out
}

func main() {
	bridge := flag.String("bridge", "http://127.0.0.1:18181", "bridge base URL")
	duration := flag.Duration("duration", 8*time.Second, "per-scenario duration")
	concurrencyStr := flag.String("concurrency", "1,10,50,100", "comma-separated concurrency levels for proxy scenarios")
	warmup := flag.Bool("warmup", true, "run a short warmup before measuring")
	flag.Parse()

	// start mock upstream
	upstream, err := newMockUpstream()
	if err != nil {
		fmt.Fprintln(os.Stderr, "mock upstream error:", err)
		os.Exit(1)
	}
	defer upstream.close()
	fmt.Printf("mock upstream: %s\n", upstream.baseURL())

	// ensure api key exists for proxy auth; bridge seeds a default admin key.
	// create a dedicated proxy api key.
	apiKey := "perf-proxy-key"
	if err := createAPIKey(*bridge, apiKey); err != nil {
		fmt.Fprintln(os.Stderr, "create api key failed (continuing with existing):", err)
	}

	// provision routing
	if err := provision(*bridge, upstream.baseURL(), ""); err != nil {
		fmt.Fprintln(os.Stderr, "provision failed:", err)
		os.Exit(1)
	}

	chatBody := map[string]interface{}{
		"model": "perf-model", "messages": []map[string]interface{}{
			{"role": "user", "content": "hello world benchmark"},
		},
	}
	convBody := map[string]interface{}{
		"model": "conv-model", "messages": []map[string]interface{}{
			{"role": "user", "content": "cross protocol conversion benchmark"},
		},
	}
	streamBody := map[string]interface{}{
		"model": "perf-model", "stream": true, "messages": []map[string]interface{}{
			{"role": "user", "content": "streaming benchmark"},
		},
	}

	fmt.Printf("bridge: %s  duration/scenario: %s  concurrency: %s\n\n", *bridge, *duration, *concurrencyStr)

	// ---- baseline: lightweight endpoints, fixed concurrency ----
	baseConc := 50
	fmt.Println("== baseline (concurrency 50) ==")
	baseDuration := *duration
	if *warmup {
		_ = runScenario(*bridge, apiKey, scenario{"warmup", "GET", "/healthz", nil, false}, baseConc, 2*time.Second)
	}
	report("GET /healthz", runScenario(*bridge, apiKey, scenario{"health", "GET", "/healthz", nil, false}, baseConc, baseDuration), baseDuration)
	report("GET /api/v1/runtime/state", runScenario(*bridge, apiKey, scenario{"state", "GET", "/api/v1/runtime/state", nil, false}, baseConc, baseDuration), baseDuration)
	report("GET /api/v1/providers", runScenario(*bridge, apiKey, scenario{"providers", "GET", "/api/v1/providers", nil, false}, baseConc, baseDuration), baseDuration)
	fmt.Println()

	// ---- proxy: concurrency sweep ----
	fmt.Printf("== proxy (sweep %s, %s each) ==\n", *concurrencyStr, *duration)
	for _, c := range parseConcurrencyList(*concurrencyStr) {
		if *warmup {
			_ = runScenario(*bridge, apiKey, scenario{"warmup", "POST", "/v1/chat/completions", chatBody, true}, c, 2*time.Second)
		}
		s := runScenario(*bridge, apiKey, scenario{"chat-same-proto", "POST", "/v1/chat/completions", chatBody, true}, c, *duration)
		report(fmt.Sprintf("chat same-protocol  c=%d", c), s, *duration)
	}
	fmt.Println()
	for _, c := range parseConcurrencyList(*concurrencyStr) {
		s := runScenario(*bridge, apiKey, scenario{"chat->anthropic conv", "POST", "/v1/chat/completions", convBody, true}, c, *duration)
		report(fmt.Sprintf("chat->anthropic     c=%d", c), s, *duration)
	}
	fmt.Println()
	for _, c := range parseConcurrencyList(*concurrencyStr) {
		s := runScenario(*bridge, apiKey, scenario{"chat stream", "POST", "/v1/chat/completions", streamBody, true}, c, *duration)
		report(fmt.Sprintf("chat stream         c=%d", c), s, *duration)
	}
	fmt.Println()

	fmt.Printf("mock upstream total hits: %d\n", upstream.hits.Load())
}

func createAPIKey(bridge, key string) error {
	body := map[string]interface{}{
		"id": "perf-proxy-key", "name": "Perf Proxy Key",
		"secret": key, "scopes": "*", "enabled": true,
	}
	buf, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", bridge+"/api/v1/api-keys", bytes.NewReader(buf))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 && resp.StatusCode != 409 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("status %d body %s", resp.StatusCode, string(b))
	}
	io.Copy(io.Discard, resp.Body)
	return nil
}
