# Extension API changelog

[Leia em português](api-changelog.md)

This file tracks the changes to the Synapse extension API, which is defined in synapse.d.ts. The API version is the one the host exposes in synapse.version and the one each extension manifest compares in the engines.synapse field.

## Compatibility

The API follows semantic versioning. Minor versions only add things, and a major version can only remove what has been marked as deprecated for at least one major version.

The host supports the two most recent major versions, which today are 2 and 1. Extensions that ask for anything older still install, but with a warning, and they may stop working without notice.

Deprecated APIs keep working during that whole window. The host logs a single warning per extension and per API in the extension output panel, and the running extensions panel lists those calls. Every removal is announced here and in the [API reference](../../docs/extensoes-api.html), together with the version in which it will happen.

## 2.5.0

This version added synapse.mcp.registerTool, which exposes a function from the extension as an MCP tool for agents connected to the relay. It requires the mcp permission, and the public name joins the publisher, the extension name and the tool name, as in ext_synapse_sort_lines__sort_text. Tool metadata can also be declared in contributes.mcpTools. It also added synapse.env.appRoot with the base URL of the IDE, which helps when calling endpoints on the same origin. The manifest gained extensionPack and extensionDependencies, which are resolved and installed in chain from the registry, along with contributes.mcpTools and the network:self permission, which allows access to the same origin as the IDE. The IDE itself now loads the built in extensions synapse.bug-report, synapse.sort-lines and synapse.todo-highlighter through the public API.

A few problems were fixed. The webview.nonce and webview.cspSource fields are now available right after createWebviewPanel. Before, they stayed empty until the host answered, which broke the CSP for anyone reading the nonce right away. Webview panels and host panels, like the extension details, no longer show up together in the editor, and opening one hides the other. The IDE now publishes SYNAPSE_VERSION, so engines.synapse no longer rejects every package thinking the IDE is version 0.0.0. Tools registered with mcp.registerTool now really reach the MCP catalog of the IDE, and the built in extensions now declare the mcp permission their tools need.

Three functions were deprecated and are expected to be removed in version 4.0.0. Instead of synapse.workspace.readFile, use synapse.workspace.fs.readFile and decode the result with TextDecoder. Instead of synapse.workspace.writeFile, use synapse.workspace.fs.writeFile with the bytes. Instead of synapse.workspace.findFilePaths, use synapse.workspace.findFiles together with synapse.workspace.asRelativePath.

## 2.4.0

Added extension tests in synapse.test, the preview APIs and keybindings.bindingFor.

## 2.0.0

First stable version, with the host isolated in a Worker, declarative permissions and webviews with CSP.
