# The plugin's server when there's no runner to start: a stdio MCP server that
# lists the runner's five tools and answers every call with why no review can
# be made here. bin/mergecomplete-mcp runs it, with the reason in MC_REASON and
# the tools' file in MC_TOOLS, so the agent can tell the person and nothing
# fails without a reason.
#
# With MC_BRIDGE=1 it answers one message instead, for the launcher while it
# installs the runner (bin/mergecomplete-mcp's bridge): initialize, ping and
# tools/list are answered as the runner answers them, with its instructions
# from MC_INSTRUCTIONS, and the exit status says what the message was:
#   0   answered
#   10  initialize, answered, which the runner is to read first
#   11  a notification, not answered, which the runner is to read first
#   12  anything else, not answered, which only the runner can answer
#
# awk because it is on every macOS and Linux machine the launcher runs on, and
# reads a line at a time without a process per message. It isn't a JSON
# parser, but it reads the id and the method at the top level of the request,
# wherever they are in it: Claude Code and Cursor send the id last, after
# params, and a tool's arguments can hold a key named id too.
# mergecomplete-mcp.exe is the same server for Windows, in Go.

function esc(s,    out, i, c) {
	# A character at a time, since what gsub makes of a backslash in its
	# replacement differs between awks.
	out = ""
	for (i = 1; i <= length(s); i++) {
		c = substr(s, i, 1)
		if (c == "\\") out = out "\\\\"
		else if (c == "\"") out = out "\\\""
		else if (c == "\t" || c == "\n" || c == "\r") out = out " "
		else out = out c
	}
	return out
}

# field is the first value of name anywhere in line, for protocolVersion,
# which only initialize's params hold.
function field(line, name, pattern,    v) {
	if (!match(line, "\"" name "\"[ \t]*:[ \t]*" pattern)) return ""
	v = substr(line, RSTART, RLENGTH)
	sub("^\"" name "\"[ \t]*:[ \t]*", "", v)
	return v
}

# top is the value of key name in the request's own object, not in anything
# nested in it, as it's written: a string with its quotes, or a number. It's
# "" when the object has no such key, or its value is an object or an array.
function top(line, name,    n, i, c, depth, instr, escaped, rest) {
	n = length(line)
	depth = 0
	instr = 0
	escaped = 0
	for (i = 1; i <= n; i++) {
		c = substr(line, i, 1)
		if (instr) {
			if (escaped) escaped = 0
			else if (c == "\\") escaped = 1
			else if (c == "\"") instr = 0
			continue
		}
		if (c == "{" || c == "[") depth++
		else if (c == "}" || c == "]") depth--
		else if (c == "\"") {
			if (depth == 1) {
				rest = substr(line, i)
				if (match(rest, "^\"" name "\"[ \t]*:[ \t]*")) {
					rest = substr(rest, RLENGTH + 1)
					if (match(rest, "^(\"([^\"\\\\]|\\\\.)*\"|-?[0-9][0-9.eE+-]*|null)")) return substr(rest, 1, RLENGTH)
					return ""
				}
			}
			instr = 1
		}
	}
	return ""
}

# version is the protocol version to answer initialize with: the client's,
# when it's one the runner speaks, and otherwise the newest the runner answers
# with, as the runner's own MCP library chooses.
function version(line,    v) {
	v = field(line, "protocolVersion", "\"[^\"]*\"")
	if (v == "\"2024-11-05\"" || v == "\"2025-03-26\"" || v == "\"2025-06-18\"" || v == "\"2025-11-25\"") return v
	return "\"2025-11-25\""
}

function send(s) {
	printf "%s\n", s
	fflush()
}

function slurp(file,    l, all) {
	all = ""
	if (file == "") return ""
	while ((getline l < file) > 0) {
		sub(/^[ \t]+/, "", l)
		all = all l
	}
	close(file)
	return all
}

BEGIN {
	bridge = ENVIRON["MC_BRIDGE"] == "1"
	reason = esc(ENVIRON["MC_REASON"])
	if (reason == "") reason = "There's no runner on this machine, so no review can be made here."
	instructions = reason
	if (bridge) instructions = esc(slurp(ENVIRON["MC_INSTRUCTIONS"]))
	tools = slurp(ENVIRON["MC_TOOLS"])
	if (tools == "") tools = "[]"
}

{
	line = $0
	sub(/\r$/, "", line)
	if (line ~ /^[ \t]*$/) next
	if (line !~ /^[ \t]*\{/) {
		if (bridge) exit 12
		send("{\"jsonrpc\":\"2.0\",\"id\":null,\"error\":{\"code\":-32700,\"message\":\"Parse error\"}}")
		next
	}

	id = top(line, "id")
	method = top(line, "method")
	gsub(/"/, "", method)
	if (id == "null") id = ""
	# A notification has no id, and a response to us has no method: neither is answered.
	if (id == "" || method == "") {
		if (bridge) exit (method == "" ? 12 : 11)
		next
	}

	head = "{\"jsonrpc\":\"2.0\",\"id\":" id ","
	if (method == "initialize") {
		send(head "\"result\":{\"protocolVersion\":" version(line) ",\"capabilities\":{\"tools\":{}},\"serverInfo\":{\"name\":\"mergecomplete\",\"version\":\"" (bridge ? "starting" : "no runner") "\"},\"instructions\":\"" instructions "\"}}")
		if (bridge) exit 10
	} else if (method == "ping") {
		send(head "\"result\":{}}")
	} else if (method == "tools/list") {
		send(head "\"result\":{\"tools\":" tools "}}")
	} else if (bridge) {
		exit 12
	} else if (method == "tools/call") {
		send(head "\"result\":{\"content\":[{\"type\":\"text\",\"text\":\"" reason "\"}],\"isError\":true}}")
	} else {
		send(head "\"error\":{\"code\":-32601,\"message\":\"Method not found: " esc(method) "\"}}")
	}
}
