import { MCPClientManager } from "@mcpjam/sdk";

let manager;

beforeAll(async () => {
    manager = new MCPClientManager({
        pokemon_mcp: {
            command: "python",
            args: ["pokemon-mcp.py"]
        },
    });
});

afterAll(async () => {
    if (manager && typeof manager.disconnectAll === 'function') {
        await manager.disconnectAll();
    }
});


test("should call get_pokemon tool correctly", async () => {
    const result = await manager.executeTool("pokemon_mcp", "get_pokemon", {
        name: "pikachu",
    });
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].text).toContain("Pikachu");
    expect(result.content[0].text).toContain("Type(s):");
    expect(result.content[0].text).toContain("Height:");
    expect(result.content[0].text).toContain("Weight:");
    expect(result.content[0].text).toContain("Abilities:");
});

test("should handle pokemon not found", async () => {
    const result = await manager.executeTool("pokemon_mcp", "get_pokemon", {
        name: "digimon",
    });
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].text).toContain("Error");
});

test("should list tools from pokemon_mcp server", async () => {
    const tools = await manager.getTools(["pokemon_mcp"]);
    expect(tools).toBeDefined();
    expect(typeof tools).toBe("object");
    expect(tools.tools).toBeDefined();
    expect(Array.isArray(tools.tools)).toBe(true);
    expect(tools.tools.length).toBeGreaterThanOrEqual(3);
});

test("should call get_pokemon_type tool correctly", async () => {
    const result = await manager.executeTool("pokemon_mcp", "get_pokemon_type", {
        type_name: "electric",
    });
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].text).toContain("Type: Electric");
    expect(result.content[0].text).toContain("Pokemon with this type");
    expect(result.content[0].text).toContain("pikachu");
});

test("should handle invalid pokemon type", async () => {
    const result = await manager.executeTool("pokemon_mcp", "get_pokemon_type", {
        type_name: "invalidtype123",
    });
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].text).toContain("Error");
});

test("should call get_random_pokemon tool", async () => {
    const result = await manager.executeTool("pokemon_mcp", "get_random_pokemon", {});
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].text).toContain("Random Pokemon:");
    expect(result.content[0].text).toContain("#");
    expect(result.content[0].text).toContain("Type(s):");
});

test("should get pokemon by ID", async () => {
    const result = await manager.executeTool("pokemon_mcp", "get_pokemon", {
        name: "25",
    });
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].text).toContain("Pikachu");
    expect(result.content[0].text).toContain("#25");
});

test("should verify all tools are available", async () => {
    const tools = await manager.getTools(["pokemon_mcp"]);
    expect(tools.tools).toBeDefined();
    expect(Array.isArray(tools.tools)).toBe(true);
    
    const toolNames = tools.tools.map(tool => tool.name);
    
    expect(toolNames).toContain("get_pokemon");
    expect(toolNames).toContain("get_pokemon_type");
    expect(toolNames).toContain("get_random_pokemon");
});

