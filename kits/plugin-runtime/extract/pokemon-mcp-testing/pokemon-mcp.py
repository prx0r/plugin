from fastmcp import FastMCP
import requests

mcp = FastMCP("My MCP Server")

@mcp.tool()
def get_pokemon(name: str) -> str:
    """Gets information about a Pokemon by name or ID from the PokeAPI."""
    try:
        response = requests.get(f"https://pokeapi.co/api/v2/pokemon/{name.lower()}")
        response.raise_for_status()
        data = response.json()
        
        # Extract key information
        pokemon_name = data['name'].capitalize()
        pokemon_id = data['id']
        types = [t['type']['name'] for t in data['types']]
        height = data['height'] / 10  # Convert to meters
        weight = data['weight'] / 10  # Convert to kg
        abilities = [a['ability']['name'] for a in data['abilities']]
        
        return f"""Pokemon: {pokemon_name} (#{pokemon_id})
            Type(s): {', '.join(types)}
            Height: {height}m
            Weight: {weight}kg
            Abilities: {', '.join(abilities)}"""
    except requests.exceptions.RequestException as e:
        return f"Error fetching Pokemon data: {str(e)}"

@mcp.tool()
def get_pokemon_type(type_name: str) -> str:
    """Gets information about a Pokemon type and lists Pokemon of that type."""
    try:
        response = requests.get(f"https://pokeapi.co/api/v2/type/{type_name.lower()}")
        response.raise_for_status()
        data = response.json()
        
        type_name = data['name'].capitalize()
        pokemon_list = [p['pokemon']['name'] for p in data['pokemon'][:20]]  # Limit to first 20
        
        return f"""Type: {type_name}
Pokemon with this type (first 20): {', '.join(pokemon_list)}"""
    except requests.exceptions.RequestException as e:
        return f"Error fetching type data: {str(e)}"

@mcp.tool()
def get_random_pokemon() -> str:
    """Gets information about a random Pokemon."""
    import random
    try:
        # There are approximately 1025 Pokemon as of Gen 9
        random_id = random.randint(1, 1025)
        response = requests.get(f"https://pokeapi.co/api/v2/pokemon/{random_id}")
        response.raise_for_status()
        data = response.json()
        
        pokemon_name = data['name'].capitalize()
        pokemon_id = data['id']
        types = [t['type']['name'] for t in data['types']]
        
        return f"""Random Pokemon: {pokemon_name} (#{pokemon_id})
            Type(s): {', '.join(types)}"""
    except requests.exceptions.RequestException as e:
        return f"Error fetching random Pokemon: {str(e)}"

if __name__ == "__main__":
    mcp.run()