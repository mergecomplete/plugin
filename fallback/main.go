// Command mergecomplete-mcp.exe is the plugin's server on Windows, which the
// runner has no build for yet. It lists the runner's five tools and answers
// every call with that, so the agent can tell the person, and nothing fails
// without a reason. server.awk is the same server for a macOS or Linux machine
// the launcher couldn't start a runner on.
//
// Every manifest starts bin/mergecomplete-mcp, with no extension. On Windows
// that can't be the shell script beside it: Node's spawn, which Claude Code and
// Cursor use, and Rust's Command, which Codex uses, both look for the name with
// .exe added, and find this. So it's a program, which needs nothing installed
// on the machine to run. scripts/build-windows.sh builds it, and CI builds it
// again and fails if the committed file differs.
package main

import (
	"bufio"
	"bytes"
	_ "embed"
	"encoding/json"
	"os"
)

//go:embed tools.json
var toolsFile []byte

const reason = "There's no runner for Windows yet: the runner is built for macOS and Linux, so no review can be made on this machine. On Windows, the Linux build runs inside WSL: run the agent inside WSL, and the plugin installs the runner there and these tools work. Calling a tool again here gives the same answer."

type request struct {
	ID     json.RawMessage `json:"id"`
	Method string          `json:"method"`
	Params struct {
		ProtocolVersion string `json:"protocolVersion"`
	} `json:"params"`
}

type text struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

func main() {
	var tools bytes.Buffer
	if err := json.Compact(&tools, toolsFile); err != nil {
		tools.Reset()
		tools.WriteString("[]")
	}

	out := bufio.NewWriter(os.Stdout)
	send := func(v any) {
		line, _ := json.Marshal(v)
		out.Write(line)
		out.WriteByte('\n')
		out.Flush()
	}

	in := bufio.NewScanner(os.Stdin)
	in.Buffer(make([]byte, 0, 64*1024), 16<<20)
	for in.Scan() {
		line := bytes.TrimSpace(in.Bytes())
		if len(line) == 0 {
			continue
		}
		var req request
		if err := json.Unmarshal(line, &req); err != nil {
			send(map[string]any{"jsonrpc": "2.0", "id": nil, "error": map[string]any{"code": -32700, "message": "Parse error"}})
			continue
		}
		// A notification has no id, and a response to us has no method: neither is answered.
		if len(req.ID) == 0 || string(req.ID) == "null" || req.Method == "" {
			continue
		}

		answer := map[string]any{"jsonrpc": "2.0", "id": req.ID}
		switch req.Method {
		case "initialize":
			version := req.Params.ProtocolVersion
			if version == "" {
				version = "2025-06-18"
			}
			answer["result"] = map[string]any{
				"protocolVersion": version,
				"capabilities":    map[string]any{"tools": map[string]any{}},
				"serverInfo":      map[string]any{"name": "mergecomplete", "version": "no runner"},
				"instructions":    reason,
			}
		case "ping":
			answer["result"] = map[string]any{}
		case "tools/list":
			answer["result"] = map[string]any{"tools": json.RawMessage(tools.Bytes())}
		case "tools/call":
			answer["result"] = map[string]any{"content": []text{{"text", reason}}, "isError": true}
		default:
			answer["error"] = map[string]any{"code": -32601, "message": "Method not found: " + req.Method}
		}
		send(answer)
	}
}
