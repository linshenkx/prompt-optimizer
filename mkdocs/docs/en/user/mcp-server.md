# Connect to the Docker MCP server

The Prompt Optimizer container exposes three tools for optimizing user prompts, optimizing system prompts, and iterating on a prompt. Set the model credentials in the container environment. [Docker setup](../deployment/docker-basic.md)

In your AI client, add a **Streamable HTTP** MCP server. If you mapped port `8081` on your computer to port `80` in the container, use `http://localhost:8081/mcp`. For a remote deployment, use the address of your container followed by `/mcp`.
