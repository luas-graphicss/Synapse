# TODO markers

Built in extension of the Synapse IDE that highlights the TODO, FIXME, HACK, NOTE and XXX markers in the active editor. The list of words can be changed in the synapse.todo.keywords setting.

Each marker also becomes a light diagnostic in the Problems panel, and the status bar shows how many markers the open file has. Clicking that item opens the full list so you can jump straight to each one.

Agents connected through MCP get the list_markers tool, which goes through the project using a glob pattern and returns every marker it finds.
