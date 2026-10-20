# Synapse

[Leia em português](README.pt-BR.md)

Synapse is a code editor for web projects that runs entirely in the browser. You open the page, create or import a project and start working right away, with the file explorer, the editor, the live preview and a terminal on the same screen. There is no account and no sign up. Projects are saved in the browser itself, so nothing leaves your machine unless you export it or connect an outside service.

The editor has syntax highlighting, code folding, a minimap, search, keyboard shortcuts and version history. The preview updates while you type, can simulate different devices, zoom, reload or open in a new tab, and it shows the runtime errors of the page. The terminal runs commands inside the project folder with live output and background processes, and the build tools install dependencies, run npm scripts, start a dev server and can even compile with CMake. You can import ZIP files or whole folders and export the project whenever you want.

Beyond the basics there are a few bigger pieces. Blepse 3D is a modeling studio inside the editor, where you create models, export them as GLB and use them right away in the project. There is an AI assistant that works with several providers, reads the project files and suggests edits. And there is an extension system with its own API, permissions, webviews and a small package registry, plus three extensions that come with the editor, which are the bug report form, the line sorter and the TODO highlighter.

One of the main features is the MCP connector. Inside the editor you generate a private address, and any agent that speaks MCP can use it to open files, edit code, use the terminal and look at the preview of the project open in your browser. Agents that only have a terminal can open the same address and get the instructions together with a ready to use command line client in Python, Node or Bash. The connection goes through a small relay that runs on Cloudflare Workers.

## How to use

The quickest way is to open the hosted version at https://sypnase-live-preview.vercel.app and create a project from the start screen. The full documentation is written in Portuguese and lives in the [documentation pages](IDE%20Sypnase/docs), which are also published on the same site.

To run it yourself, serve the IDE Sypnase folder with any static file server. The editor, the preview and the 3D studio work that way. The AI assistant, the bug report and the Notion integration use the serverless functions in the api folder, so for those the project has to run on Vercel or locally with vercel dev. The MCP relay is a separate Cloudflare Worker, configured in the Wrangler files at the root of the IDE folder, and it can be published with Wrangler itself.

Changes to the extension API are recorded in the [API changelog](IDE%20Sypnase/assets/extensoes/api-changelog.en.md), and each built in extension has its own README and CHANGELOG in the [built in extensions folder](IDE%20Sypnase/assets/extensoes/embutidas).

## Development time

Synapse took about seven and a half months to reach this version, and the project is complete in its current form.

## License

GNU General Public License version 3. The full text is in the LICENSE file.
