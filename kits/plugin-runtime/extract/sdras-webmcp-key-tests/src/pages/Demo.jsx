import { DynamicKeys } from "../sections/DynamicKeys.jsx";
import { SimpleKeys } from "../sections/SimpleKeys.jsx";
import { WebMCPKeys } from "../sections/WebMCPKeys.jsx";

export function DemoPage({ mcp, onInstallShim }) {
  return (
    <>
      <main>
        <SimpleKeys />
        <DynamicKeys />
        <WebMCPKeys mcp={mcp} onInstallShim={onInstallShim} />
      </main>

      <footer>
        <a href="https://github.com/webmachinelearning/webmcp" target="_blank" rel="noopener">
          WebMCP spec
        </a>
        {" · "}
        <a href="https://www.npmjs.com/package/use-webmcp-tool" target="_blank" rel="noopener">
          use-webmcp-tool
        </a>
        {" · "}
        <a href="https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key" target="_blank" rel="noopener">
          React docs on keys
        </a>
      </footer>
    </>
  );
}
