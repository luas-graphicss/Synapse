# Sort lines

Built in extension of the Synapse IDE that works on the current selection, or on the whole file when nothing is selected.

F9 sorts the lines from A to Z, and holding Shift while pressing F9 sorts them from Z to A. Sorting is natural and ignores letter case, so item2 comes before item10. From the command palette or the editor context menu you can also remove duplicate lines, reverse the order and trim the spaces left at the end of each line.

Agents connected through MCP can use the sort_text tool to sort a piece of text without touching the editor.
