# MCP Client Manager - Pokemon MCP Server

A Model Context Protocol (MCP) server implementation that provides Pokemon-related tools using the PokeAPI. This project demonstrates how to create and test MCP servers using FastMCP (Python) and test them with the MCP Client Manager SDK (Node.js).

## Features

- 🔍 **Get Pokemon Info**: Fetch detailed information about any Pokemon by name or ID
- 🎨 **Get Pokemon Type**: Get information about Pokemon types and list Pokemon of that type
- 🎲 **Get Random Pokemon**: Discover a random Pokemon from the entire Pokedex
- ✅ **Comprehensive Tests**: Full test suite using Jest

## Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.8 or higher)
- **npm** or **yarn**
- **pip** (Python package manager)

## Project Structure

```
mcp-client-manager/
├── pokemon-mcp.py           # FastMCP server with Pokemon tools
├── tests/
│   └── pokemon-mcp.test.js  # Jest tests for Pokemon MCP
├── package.json             # Node.js dependencies
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## Setup

### 1. Install Node.js Dependencies

```bash
npm install
```

This will install:
- `@mcpjam/sdk` - MCP Client Manager SDK
- `jest` - Testing framework

### 2. Install Python Dependencies

```bash
pip install fastmcp requests
```

- `fastmcp` - Framework for building MCP servers
- `requests` - HTTP library for API calls

## Running the Pokemon MCP Server

Start the Pokemon MCP server:

```bash
python pokemon-mcp.py
```

The server will start in STDIO transport mode by default, ready to receive MCP protocol messages.

## Available Tools

### 1. `get_pokemon`
Get detailed information about a specific Pokemon.

**Parameters:**
- `name` (string): Pokemon name or ID

**Example:**
```javascript
await manager.executeTool("pokemon_mcp", "get_pokemon", {
    name: "pikachu"
});
```

**Returns:**
- Pokemon name and ID
- Type(s)
- Height and weight
- Abilities

### 2. `get_pokemon_type`
Get information about a Pokemon type and list Pokemon of that type.

**Parameters:**
- `type_name` (string): Type name (e.g., "fire", "water", "electric")

**Example:**
```javascript
await manager.executeTool("pokemon_mcp", "get_pokemon_type", {
    type_name: "electric"
});
```

**Returns:**
- Type name
- List of first 20 Pokemon with that type

### 3. `get_random_pokemon`
Get information about a random Pokemon.

**Parameters:** None

**Example:**
```javascript
await manager.executeTool("pokemon_mcp", "get_random_pokemon", {});
```

**Returns:**
- Random Pokemon name and ID
- Type(s)

## Running Tests

Run all tests:

```bash
npm test
```

Run specific test file:

```bash
npm test pokemon-mcp.test.js
```

### Test Coverage

The test suite includes:
- ✅ Getting Pokemon by name
- ✅ Getting Pokemon by ID
- ✅ Handling invalid Pokemon names
- ✅ Getting Pokemon type information
- ✅ Handling invalid types
- ✅ Getting random Pokemon
- ✅ Listing all available tools
- ✅ Verifying tool availability

## How It Works

### MCP Architecture

1. **Server Side (Python)**:
   - `pokemon-mcp.py` uses FastMCP to create an MCP server
   - Defines tools using the `@mcp.tool()` decorator
   - Each tool function includes a docstring (used as tool description)
   - Server communicates via STDIO (standard input/output)

2. **Client Side (Node.js)**:
   - Tests use `MCPClientManager` from `@mcpjam/sdk`
   - Manager spawns the Python process and communicates via MCP protocol
   - `getTools()` retrieves available tools from the server
   - `executeTool()` invokes a specific tool with parameters

### Communication Flow

```
┌─────────────────┐         MCP Protocol          ┌─────────────────┐
│   Jest Tests    │◄─────────(STDIO)──────────────►│  FastMCP Server │
│   (Node.js)     │                                │    (Python)     │
└─────────────────┘                                └─────────────────┘
        │                                                   │
        │ 1. Start server                                  │
        │ 2. Request tools list                            │
        │ 3. Execute tool with params                      │
        │ 4. Receive results                               │
        │                                                   │
        └──────────────────────────────────────────────────┘
```

### Example: Tool Execution Flow

1. Test calls `manager.executeTool("pokemon_mcp", "get_pokemon", { name: "pikachu" })`
2. MCPClientManager sends MCP message to Python server via STDIO
3. FastMCP receives message and routes to `get_pokemon()` function
4. Function calls PokeAPI: `https://pokeapi.co/api/v2/pokemon/pikachu`
5. Function processes response and returns formatted string
6. FastMCP sends result back via MCP protocol
7. Test receives and validates the result

## API Reference

This project uses the free [PokeAPI](https://pokeapi.co/) to fetch Pokemon data. No API key required!

## Troubleshooting

### Tests hang or don't exit
This is expected behavior due to the persistent connection between the test client and MCP server. Jest will warn about this but tests still pass.

### Python module not found
Make sure you've installed the required Python packages:
```bash
pip install fastmcp requests
```

### Connection errors
Ensure the Python server path in tests matches your actual file location:
```javascript
args: ["pokemon-mcp.py"]  // Relative to project root
```

## Contributing

Feel free to add more Pokemon-related tools or improve existing ones!

### Ideas for New Tools
- Get Pokemon evolution chain
- Get Pokemon moves
- Get Pokemon stats comparison
- Get Pokemon by generation
- Get Pokemon by habitat

## Resources

- [FastMCP Documentation](https://gofastmcp.com)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [PokeAPI Documentation](https://pokeapi.co/docs/v2)
- [@mcpjam/sdk](https://www.npmjs.com/package/@mcpjam/sdk)
