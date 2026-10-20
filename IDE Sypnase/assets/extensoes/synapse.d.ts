   
                                           
                                                                                                                 
                                                                                                       
   
declare namespace synapse {
	                                                                                                
	const version: string;

	                                                                     
	class Disposable {
		                                                                     
		constructor(callOnDispose: () => void);
		                                           
		static from(...disposables: { dispose(): any }[]): Disposable;
		                                                          
		dispose(): void;
	}

	                                                                                      
	interface Event<T> {
		                                                                                                
		(listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]): Disposable;
	}

	                                                                                
	class EventEmitter<T> {
		                                       
		readonly event: Event<T>;
		                                             
		fire(data: T): void;
		                                
		dispose(): void;
	}

	                                                                               
	interface CancellationToken {
		                                                  
		readonly isCancellationRequested: boolean;
		                                              
		readonly onCancellationRequested: Event<void>;
	}

	                                       
	class CancellationTokenSource {
		                                    
		readonly token: CancellationToken;
		                           
		cancel(): void;
		                                    
		dispose(): void;
	}

	                                                                                                 
	class Uri {
		                                              
		readonly scheme: string;
		                                       
		readonly authority: string;
		                                          
		readonly path: string;
		                            
		readonly query: string;
		                         
		readonly fragment: string;
		                                                                       
		readonly fsPath: string;
		                                                                         
		static file(path: string): Uri;
		                                      
		static parse(value: string): Uri;
		                                                
		static joinPath(base: Uri, ...pathSegments: string[]): Uri;
		                                      
		static isUri(value: any): value is Uri;
		                                                               
		with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri;
		                           
		toString(): string;
	}

	                                                          
	class Position {
		                             
		readonly line: number;
		                                                    
		readonly character: number;
		                        
		constructor(line: number, character: number);
		                                                   
		isBefore(other: Position): boolean;
		                                                
		isBeforeOrEqual(other: Position): boolean;
		                                       
		isAfter(other: Position): boolean;
		                                                 
		isAfterOrEqual(other: Position): boolean;
		                                          
		isEqual(other: Position): boolean;
		                                              
		compareTo(other: Position): number;
		                                                 
		translate(lineDelta?: number, characterDelta?: number): Position;
		                                                       
		with(line?: number, character?: number): Position;
	}

	                                                                              
	class Range {
		                           
		readonly start: Position;
		                        
		readonly end: Position;
		                                            
		readonly isEmpty: boolean;
		                                                         
		readonly isSingleLine: boolean;
		                                      
		constructor(start: Position, end: Position);
		                                       
		constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
		                                               
		contains(positionOrRange: Position | Range): boolean;
		                                      
		isEqual(other: Range): boolean;
		                                             
		intersection(range: Range): Range | undefined;
		                                         
		union(other: Range): Range;
		                                              
		with(start?: Position, end?: Position): Range;
	}

	                                                                                              
	class Selection extends Range {
		                               
		readonly anchor: Position;
		                         
		readonly active: Position;
		                                                    
		readonly isReversed: boolean;
		                                      
		constructor(anchor: Position, active: Position);
		                                       
		constructor(anchorLine: number, anchorCharacter: number, activeLine: number, activeCharacter: number);
	}

	                                                        
	class TextEdit {
		                         
		range: Range;
		                  
		newText: string;
		                       
		constructor(range: Range, newText: string);
		                                         
		static replace(range: Range, newText: string): TextEdit;
		                                        
		static insert(position: Position, newText: string): TextEdit;
		                                     
		static delete(range: Range): TextEdit;
		                                                    
		static setEndOfLine(eol: EndOfLine): TextEdit;
	}

	                                                                                                   
	class SnippetString {
		                        
		value: string;
		                                    
		constructor(value?: string);
		                                                        
		appendText(text: string): SnippetString;
		                                  
		appendTabstop(number?: number): SnippetString;
		                                              
		appendPlaceholder(value: string | ((snippet: SnippetString) => any), number?: number): SnippetString;
		                                            
		appendChoice(values: readonly string[], number?: number): SnippetString;
		                                                
		appendVariable(name: string, defaultValue: string | ((snippet: SnippetString) => any)): SnippetString;
	}

	                                                                                               
	class WorkspaceEdit {
		                                       
		readonly size: number;
		                                  
		replace(uri: Uri | string, range: Range, newText: string): void;
		                                     
		insert(uri: Uri | string, position: Position, newText: string): void;
		                              
		delete(uri: Uri | string, range: Range): void;
		                                       
		has(uri: Uri | string): boolean;
		                                          
		set(uri: Uri | string, edits: readonly TextEdit[]): void;
		                                      
		get(uri: Uri | string): TextEdit[];
		                                                                                       
		expectVersion(uri: Uri | string, version: number): void;
		                                                    
		createFile(uri: Uri | string, options?: { overwrite?: boolean; ignoreIfExists?: boolean; contents?: string }): void;
		                        
		deleteFile(uri: Uri | string, options?: { ignoreIfNotExists?: boolean }): void;
		                                
		renameFile(oldUri: Uri | string, newUri: Uri | string, options?: { overwrite?: boolean; ignoreIfExists?: boolean }): void;
		                              
		entries(): [Uri, TextEdit[]][];
	}

	                                            
	class FileSystemError extends Error {
		                                                                                                                     
		readonly code: string;
		                           
		static FileNotFound(messageOrUri?: string | Uri): FileSystemError;
		                         
		static FileExists(messageOrUri?: string | Uri): FileSystemError;
		                          
		static FileNotADirectory(messageOrUri?: string | Uri): FileSystemError;
		                        
		static FileIsADirectory(messageOrUri?: string | Uri): FileSystemError;
		                                       
		static NoPermissions(messageOrUri?: string | Uri): FileSystemError;
		                            
		static Unavailable(messageOrUri?: string | Uri): FileSystemError;
	}

	                                                                  
	class MarkdownString {
		                      
		value: string;
		                                              
		isTrusted?: boolean;
		                                 
		constructor(value?: string);
		                                   
		appendText(value: string): MarkdownString;
		                                      
		appendMarkdown(value: string): MarkdownString;
		                                                   
		appendCodeblock(value: string, language?: string): MarkdownString;
	}

	                                 
	enum EndOfLine {
		            
		LF = 1,
		              
		CRLF = 2,
	}

	                                      
	interface TextLine {
		                       
		readonly lineNumber: number;
		                                 
		readonly text: string;
		                              
		readonly range: Range;
		                                    
		readonly rangeIncludingLineBreak: Range;
		                                               
		readonly firstNonWhitespaceCharacterIndex: number;
		                                        
		readonly isEmptyOrWhitespace: boolean;
	}

	                                                    
	interface TextDocument {
		                        
		readonly uri: Uri;
		                                   
		readonly fileName: string;
		                                                              
		readonly languageId: string;
		                                              
		readonly version: number;
		                                          
		readonly isDirty: boolean;
		                                           
		readonly isClosed: boolean;
		                            
		readonly lineCount: number;
		                              
		readonly eol: EndOfLine;
		                                         
		getText(range?: Range): string;
		                                    
		lineAt(lineOrPosition: number | Position): TextLine;
		                                           
		offsetAt(position: Position): number;
		                                  
		positionAt(offset: number): Position;
		                                                 
		validatePosition(position: Position): Position;
		                                                   
		validateRange(range: Range): Range;
		                                                           
		getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined;
		                         
		save(): Promise<boolean>;
	}

	                                                        
	enum TextEditorRevealType {
		                                
		Default = 0,
		                              
		InCenter = 1,
		                                             
		InCenterIfOutsideViewport = 2,
		                      
		AtTop = 3,
	}

	                                        
	enum TextEditorSelectionChangeKind {
		               
		Keyboard = 1,
		             
		Mouse = 2,
		                      
		Command = 3,
	}

	                                                                  
	enum DecorationRangeBehavior {
		                             
		OpenOpen = 0,
		                  
		ClosedClosed = 1,
		                        
		OpenClosed = 2,
		                           
		ClosedOpen = 3,
	}

	                                         
	interface DecorationRenderOptions {
		                          
		backgroundColor?: string;
		                          
		color?: string;
		                                                
		border?: string;
		                                  
		fontStyle?: string;
		                              
		fontWeight?: string;
		                                                        
		textDecoration?: string;
		                          
		opacity?: string;
		                  
		cursor?: string;
		                              
		isWholeLine?: boolean;
		                                
		rangeBehavior?: DecorationRangeBehavior;
		                                      
		after?: { contentText?: string; color?: string; margin?: string; fontStyle?: string };
		                                        
		before?: { contentText?: string; color?: string; margin?: string; fontStyle?: string };
		                                               
		gutterIconPath?: string;
		                                                     
		gutterIconSize?: string;
		                                        
		overviewRulerColor?: string;
	}

	                                               
	interface DecorationOptions {
		                 
		range: Range;
		                                 
		hoverMessage?: string | MarkdownString | (string | MarkdownString)[];
		                                                      
		renderOptions?: DecorationRenderOptions;
	}

	                                                                                                  
	interface TextEditorDecorationType extends Disposable {
		                           
		readonly key: string;
	}

	                                                         
	interface TextEditorEdit {
		                                           
		replace(location: Position | Range | Selection, value: string): void;
		                    
		insert(location: Position, value: string): void;
		                               
		delete(location: Range | Selection): void;
		                            
		setEndOfLine(endOfLine: EndOfLine): void;
	}

	                                                          
	enum ViewColumn {
		                    
		Active = -1,
		                        
		Beside = -2,
		                       
		One = 1,
		                      
		Two = 2,
	}

	                               
	interface TextEditor {
		                        
		readonly document: TextDocument;
		                                                 
		selection: Selection;
		                                        
		selections: readonly Selection[];
		                                   
		readonly visibleRanges: readonly Range[];
		                                      
		readonly options: { tabSize: number; insertSpaces: boolean };
		                                                                            
		edit(callback: (editBuilder: TextEditorEdit) => void, options?: { undoStopBefore?: boolean; undoStopAfter?: boolean }): Promise<boolean>;
		                                            
		insertSnippet(snippet: SnippetString | string, location?: Position | Range | readonly Position[] | readonly Range[]): Promise<boolean>;
		                                                        
		setDecorations(decorationType: TextEditorDecorationType, rangesOrOptions: readonly Range[] | readonly DecorationOptions[]): void;
		                            
		revealRange(range: Range, revealType?: TextEditorRevealType): void;
		                         
		show(column?: ViewColumn): void;
	}

	                                                          
	interface Memento {
		                                       
		get<T>(key: string, defaultValue?: T): T | undefined;
		                                          
		update(key: string, value: any): Promise<void>;
		                       
		keys(): readonly string[];
	}

	                                                
	interface ExtensionContext {
		                                                              
		readonly subscriptions: Disposable[];
		                                         
		readonly globalState: Memento;
		                               
		readonly workspaceState: Memento;
		                            
		readonly extensionUri: string;
		                               
		readonly extensionPath: string;
		                                             
		readonly extension: { readonly id: string; readonly packageJSON: any };
		                                                       
		asAbsolutePath(relativePath: string): string;
	}

	                                                                
	interface OutputChannel extends Disposable {
		                     
		readonly name: string;
		                                   
		append(value: string): void;
		                            
		appendLine(value: string): void;
		                                         
		clear(): void;
		                      
		show(preserveFocus?: boolean): void;
		                                               
		hide(): void;
	}

	                               
	enum StatusBarAlignment {
		                
		Left = 1,
		               
		Right = 2,
	}

	                               
	interface StatusBarItem extends Disposable {
		                             
		readonly id: string;
		            
		readonly alignment: StatusBarAlignment;
		                                                
		readonly priority: number;
		                                                   
		text: string;
		               
		tooltip: string | MarkdownString | undefined;
		                                   
		command: string | { command: string; arguments?: any[] } | undefined;
		                                   
		color: string | undefined;
		                    
		backgroundColor: string | undefined;
		                      
		name: string | undefined;
		                     
		show(): void;
		                      
		hide(): void;
	}

	                                      
	interface QuickPickItem {
		                       
		label: string;
		                                       
		description?: string;
		                               
		detail?: string;
		                                            
		picked?: boolean;
		                                             
		alwaysShow?: boolean;
	}

	                                        
	interface QuickPickOptions {
		                         
		title?: string;
		                               
		placeHolder?: string;
		                                       
		matchOnDescription?: boolean;
		                                  
		matchOnDetail?: boolean;
		                               
		canPickMany?: boolean;
		                                
		ignoreFocusOut?: boolean;
	}

	                                       
	interface InputBoxOptions {
		              
		title?: string;
		                     
		value?: string;
		                      
		prompt?: string;
		                   
		placeHolder?: string;
		                            
		password?: boolean;
		                                
		ignoreFocusOut?: boolean;
		                                                             
		validateInput?(value: string): string | { message: string } | null | undefined | Promise<string | { message: string } | null | undefined>;
	}

	                                 
	interface MessageItem {
		                       
		title: string;
		                               
		isCloseAffordance?: boolean;
	}

	                                       
	interface MessageOptions {
		                                                            
		modal?: boolean;
		                                           
		detail?: string;
	}

	                                
	enum ProgressLocation {
		                             
		Notification = 15,
		                       
		Window = 10,
	}

	                                       
	interface ProgressOptions {
		             
		location: ProgressLocation | { viewId: string };
		              
		title?: string;
		                             
		cancellable?: boolean;
	}

	                                               
	interface Progress<T> {
		                                                    
		report(value: T): void;
	}

	                    
	enum ColorThemeKind {
		             
		Light = 1,
		              
		Dark = 2,
		                             
		HighContrast = 3,
		                            
		HighContrastLight = 4,
	}

	                           
	interface ColorTheme {
		            
		readonly kind: ColorThemeKind;
		                                                            
		readonly id: string;
		                                                     
		readonly tokens: Readonly<Record<string, string>>;
	}

	                                               
	interface Webview {
		                                                               
		html: string;
		                         
		options: WebviewOptions;
		                                             
		readonly cspSource: string;
		                                                                      
		readonly onDidReceiveMessage: Event<any>;
		                                
		postMessage(message: any): Promise<boolean>;
		                                                               
		asWebviewUri(localResource: Uri | string): string;
	}

	                         
	interface WebviewOptions {
		                          
		enableScripts?: boolean;
		                           
		enableForms?: boolean;
		                                                        
		localResourceRoots?: readonly (Uri | string)[];
		                                
		retainContextWhenHidden?: boolean;
	}

	                                                   
	interface WebviewPanel extends Disposable {
		                                              
		readonly viewType: string;
		                     
		title: string;
		                       
		readonly webview: Webview;
		                                   
		readonly active: boolean;
		                             
		readonly visible: boolean;
		                                            
		readonly onDidChangeViewState: Event<{ webviewPanel: WebviewPanel }>;
		                         
		readonly onDidDispose: Event<void>;
		                                 
		reveal(viewColumn?: ViewColumn, preserveFocus?: boolean): void;
	}

	                                                                           
	interface WebviewView {
		                  
		readonly viewType: string;
		                       
		readonly webview: Webview;
		                      
		title: string;
		                                   
		description: string;
		                             
		readonly visible: boolean;
		                         
		readonly onDidDispose: Event<void>;
		                                       
		readonly onDidChangeVisibility: Event<void>;
		                     
		show(preserveFocus?: boolean): void;
	}

	                                               
	interface WebviewViewProvider {
		                                                         
		resolveWebviewView(webviewView: WebviewView, context: { state: any }, token: CancellationToken): void | Promise<void>;
	}

	                                          
	enum ConfigurationTarget {
		                         
		Global = 1,
		                     
		Workspace = 2,
	}

	                                                               
	interface WorkspaceConfiguration {
		                                        
		get<T>(section: string, defaultValue?: T): T | undefined;
		                                
		has(section: string): boolean;
		                                                         
		update(section: string, value: any, target?: ConfigurationTarget | boolean): Promise<void>;
		                           
		inspect<T>(section: string): { key: string; defaultValue?: T; globalValue?: T; workspaceValue?: T } | undefined;
	}

	                                         
	interface ConfigurationChangeEvent {
		                                            
		affectsConfiguration(section: string): boolean;
		                        
		readonly keys: readonly string[];
	}

	                                              
	enum FileType {
		                    
		Unknown = 0,
		               
		File = 1,
		                 
		Directory = 2,
	}

	                               
	interface FileStat {
		            
		type: FileType;
		                            
		ctime: number;
		                                
		mtime: number;
		                        
		size: number;
	}

	                                                                                                    
	interface FileSystem {
		                
		readFile(uri: Uri | string): Promise<Uint8Array>;
		                           
		readText(uri: Uri | string): Promise<string>;
		                            
		writeFile(uri: Uri | string, content: Uint8Array | string): Promise<void>;
		                                            
		readDirectory(uri: Uri | string): Promise<[string, FileType][]>;
		                 
		stat(uri: Uri | string): Promise<FileStat>;
		                                       
		createDirectory(uri: Uri | string): Promise<void>;
		                              
		delete(uri: Uri | string, options?: { recursive?: boolean }): Promise<void>;
		                     
		rename(source: Uri | string, target: Uri | string, options?: { overwrite?: boolean }): Promise<void>;
		             
		copy(source: Uri | string, target: Uri | string, options?: { overwrite?: boolean }): Promise<void>;
		                                        
		isWritableFileSystem(scheme: string): boolean | undefined;
	}

	                                              
	interface FileSystemWatcher extends Disposable {
		                      
		readonly onDidCreate: Event<Uri>;
		                        
		readonly onDidChange: Event<Uri>;
		                       
		readonly onDidDelete: Event<Uri>;
	}

	                                 
	enum FileChangeType {
		                
		Changed = 1,
		              
		Created = 2,
		               
		Deleted = 3,
	}

	                                   
	interface WorkspaceFolder {
		                                      
		readonly uri: Uri;
		                       
		readonly name: string;
		                
		readonly index: number;
	}

	                             
	interface ProjectInfo {
		                  
		readonly id: string;
		            
		readonly name: string;
		                                             
		readonly kind?: string;
		                                   
		readonly active: boolean;
	}

	                                 
	interface TextDocumentContentChangeEvent {
		                             
		readonly range: Range;
		                        
		readonly rangeOffset: number;
		                           
		readonly rangeLength: number;
		                      
		readonly text: string;
	}

	                                        
	interface TextDocumentChangeEvent {
		                 
		readonly document: TextDocument;
		                  
		readonly contentChanges: readonly TextDocumentContentChangeEvent[];
		                                                   
		readonly reason: number | undefined;
	}

	                                                               
	type DocumentSelector = string | DocumentFilter | readonly (string | DocumentFilter)[];

	                                                 
	interface DocumentFilter {
		                              
		language?: string;
		                                
		pattern?: string;
	}

	                                  
	enum CompletionItemKind {
		             
		Text = 0,
		              
		Method = 1,
		              
		Function = 2,
		                  
		Constructor = 3,
		             
		Field = 4,
		                
		Variable = 5,
		              
		Class = 6,
		                 
		Interface = 7,
		              
		Module = 8,
		                   
		Property = 9,
		               
		Unit = 10,
		             
		Value = 11,
		            
		Enum = 12,
		                     
		Keyword = 13,
		               
		Snippet = 14,
		           
		Color = 15,
		               
		File = 16,
		                  
		Reference = 17,
		             
		Folder = 18,
		                      
		EnumMember = 19,
		                 
		Constant = 20,
		              
		Struct = 21,
		              
		Event = 22,
		                
		Operator = 23,
		                         
		TypeParameter = 24,
	}

	                                       
	enum CompletionTriggerKind {
		                                
		Invoke = 0,
		                         
		TriggerCharacter = 1,
	}

	                              
	interface CompletionContext {
		               
		readonly triggerKind: CompletionTriggerKind;
		                              
		readonly triggerCharacter: string | undefined;
	}

	                              
	class CompletionItem {
		                     
		label: string;
		                    
		kind?: CompletionItemKind;
		                                  
		detail?: string;
		                    
		documentation?: string | MarkdownString;
		                                
		sortText?: string;
		                             
		filterText?: string;
		                                   
		insertText?: string | SnippetString;
		                             
		range?: Range;
		                                           
		commitCharacters?: string[];
		                                      
		command?: { command: string; title?: string; arguments?: any[] };
		                                
		preselect?: boolean;
		                              
		constructor(label: string, kind?: CompletionItemKind);
	}

	                                                                             
	class CompletionList {
		                                              
		isIncomplete: boolean;
		             
		items: CompletionItem[];
		                    
		constructor(items?: CompletionItem[], isIncomplete?: boolean);
	}

	                               
	interface CompletionItemProvider {
		                                        
		provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): CompletionItem[] | CompletionList | null | undefined | Promise<CompletionItem[] | CompletionList | null | undefined>;
		                                             
		resolveCompletionItem?(item: CompletionItem, token: CancellationToken): CompletionItem | Promise<CompletionItem>;
	}

	                         
	class Hover {
		                 
		contents: (MarkdownString | string)[];
		                           
		range?: Range;
		                    
		constructor(contents: MarkdownString | string | (MarkdownString | string)[], range?: Range);
	}

	                         
	interface HoverProvider {
		                                      
		provideHover(document: TextDocument, position: Position, token: CancellationToken): Hover | null | undefined | Promise<Hover | null | undefined>;
	}

	                             
	class Location {
		               
		uri: Uri;
		                 
		range: Range;
		                          
		constructor(uri: Uri | string, rangeOrPosition: Range | Position);
	}

	                                       
	interface DefinitionProvider {
		                                        
		provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Location | Location[] | null | undefined | Promise<Location | Location[] | null | undefined>;
	}

	                                      
	interface FormattingOptions {
		                            
		tabSize: number;
		                   
		insertSpaces: boolean;
	}

	                                                   
	interface DocumentFormattingEditProvider {
		                                                
		provideDocumentFormattingEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken): TextEdit[] | null | undefined | Promise<TextEdit[] | null | undefined>;
	}

	                                                                         
	class CodeActionKind {
		             
		static readonly Empty: CodeActionKind;
		                       
		static readonly QuickFix: CodeActionKind;
		                   
		static readonly Refactor: CodeActionKind;
		               
		static readonly RefactorExtract: CodeActionKind;
		              
		static readonly RefactorInline: CodeActionKind;
		                  
		static readonly RefactorRewrite: CodeActionKind;
		                       
		static readonly Source: CodeActionKind;
		                         
		static readonly SourceOrganizeImports: CodeActionKind;
		                     
		static readonly SourceFixAll: CodeActionKind;
		                     
		readonly value: string;
		                      
		constructor(value: string);
		                           
		append(parts: string): CodeActionKind;
		                                                     
		contains(other: CodeActionKind): boolean;
		                                    
		intersects(other: CodeActionKind): boolean;
	}

	                                   
	enum CodeActionTriggerKind {
		                      
		Invoke = 1,
		                                  
		Automatic = 2,
	}

	                                    
	interface CodeActionContext {
		                                 
		readonly diagnostics: readonly Diagnostic[];
		                                   
		readonly only: CodeActionKind | undefined;
		               
		readonly triggerKind: CodeActionTriggerKind;
	}

	                                           
	class CodeAction {
		                      
		title: string;
		                                     
		edit?: WorkspaceEdit;
		                               
		diagnostics?: Diagnostic[];
		                 
		kind?: CodeActionKind;
		                                     
		command?: { command: string; title?: string; arguments?: any[] };
		                                 
		isPreferred?: boolean;
		                   
		constructor(title: string, kind?: CodeActionKind);
	}

	                                   
	interface CodeActionProvider {
		                                      
		provideCodeActions(document: TextDocument, range: Range | Selection, context: CodeActionContext, token: CancellationToken): (CodeAction | { command: string; title: string; arguments?: any[] })[] | null | undefined | Promise<(CodeAction | { command: string; title: string; arguments?: any[] })[] | null | undefined>;
	}

	                       
	enum SymbolKind {
		               
		File = 0,
		              
		Module = 1,
		                 
		Namespace = 2,
		              
		Package = 3,
		              
		Class = 4,
		              
		Method = 5,
		                   
		Property = 6,
		             
		Field = 7,
		                  
		Constructor = 8,
		            
		Enum = 9,
		                 
		Interface = 10,
		              
		Function = 11,
		                
		Variable = 12,
		                 
		Constant = 13,
		              
		String = 14,
		              
		Number = 15,
		                
		Boolean = 16,
		             
		Array = 17,
		              
		Object = 18,
		             
		Key = 19,
		            
		Null = 20,
		                      
		EnumMember = 21,
		              
		Struct = 22,
		              
		Event = 23,
		                
		Operator = 24,
		                         
		TypeParameter = 25,
	}

	                                     
	class DocumentSymbol {
		            
		name: string;
		                            
		detail: string;
		            
		kind: SymbolKind;
		                          
		range: Range;
		                         
		selectionRange: Range;
		              
		children: DocumentSymbol[];
		                      
		constructor(name: string, detail: string, kind: SymbolKind, range: Range, selectionRange: Range);
	}

	                                     
	class SymbolInformation {
		            
		name: string;
		            
		kind: SymbolKind;
		                         
		containerName: string;
		                   
		location: Location;
		                      
		constructor(name: string, kind: SymbolKind, containerName: string, location: Location);
	}

	                                                                
	interface DocumentSymbolProvider {
		                        
		provideDocumentSymbols(document: TextDocument, token: CancellationToken): DocumentSymbol[] | SymbolInformation[] | null | undefined | Promise<DocumentSymbol[] | SymbolInformation[] | null | undefined>;
	}

	                                 
	enum DiagnosticSeverity {
		            
		Error = 0,
		             
		Warning = 1,
		                  
		Information = 2,
		            
		Hint = 3,
	}

	                                       
	enum DiagnosticTag {
		                                    
		Unnecessary = 1,
		                          
		Deprecated = 2,
	}

	                                    
	class Diagnostic {
		                 
		range: Range;
		                
		message: string;
		                  
		severity: DiagnosticSeverity;
		                                 
		source?: string;
		                          
		code?: string | number;
		                 
		tags?: DiagnosticTag[];
		                          
		constructor(range: Range, message: string, severity?: DiagnosticSeverity);
	}

	                                                                                  
	interface DiagnosticCollection extends Disposable {
		                                       
		readonly name: string;
		                                            
		set(uri: Uri | string, diagnostics: readonly Diagnostic[] | undefined): void;
		                                         
		set(entries: readonly [Uri | string, readonly Diagnostic[] | undefined][]): void;
		                                            
		delete(uri: Uri | string): void;
		                  
		clear(): void;
		                                        
		get(uri: Uri | string): readonly Diagnostic[] | undefined;
		                                                
		has(uri: Uri | string): boolean;
	}

	                                                                                   
	interface LanguageConfiguration {
		                                  
		comments?: { lineComment?: string; blockComment?: [string, string] };
		                          
		brackets?: [string, string][];
		                           
		autoClosingPairs?: { open: string; close: string; notIn?: string[] }[];
		                                    
		surroundingPairs?: { open: string; close: string }[];
		                        
		wordPattern?: RegExp | string;
		                                     
		folding?: { markers?: { start: RegExp | string; end: RegExp | string }; offSide?: boolean };
		                            
		indentationRules?: { increaseIndentPattern: RegExp | string; decreaseIndentPattern: RegExp | string };
	}

	                                
	enum UIKind {
		                         
		Desktop = 1,
		                         
		Mobile = 2,
	}

	                                                     
	interface Clipboard {
		                
		readText(): Promise<string>;
		                   
		writeText(value: string): Promise<void>;
	}

	                               
	interface PreviewState {
		                     
		readonly projectId: string | null;
		                       
		readonly projectName: string;
		                                          
		readonly mode: string;
		                             
		readonly url: string;
		                               
		readonly building: boolean;
	}

	                           
	interface PreviewViewport {
		                                                                     
		preset?: string;
		                     
		width?: number;
		                    
		height?: number;
		                                   
		dpr?: number;
		                  
		orientation?: 'portrait' | 'landscape';
		                   
		touch?: boolean;
	}

	                                              
	namespace commands {
		                                                                                              
		function registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): Disposable;
		                                                                           
		function registerTextEditorCommand(command: string, callback: (textEditor: TextEditor, edit: TextEditorEdit, ...args: any[]) => void, thisArg?: any): Disposable;
		                                                            
		function executeCommand<T = unknown>(command: string, ...rest: any[]): Promise<T>;
		                                            
		function getCommands(filterInternal?: boolean): Promise<string[]>;
	}

	                                                                           
	namespace window {
		                                   
		const activeTextEditor: TextEditor | undefined;
		                                        
		const visibleTextEditors: readonly TextEditor[];
		                           
		const activeColorTheme: ColorTheme;
		                                          
		const onDidChangeActiveTextEditor: Event<TextEditor | undefined>;
		                                     
		const onDidChangeTextEditorSelection: Event<{ textEditor: TextEditor; selections: readonly Selection[]; kind: TextEditorSelectionChangeKind }>;
		                                          
		const onDidChangeTextEditorVisibleRanges: Event<{ textEditor: TextEditor; visibleRanges: readonly Range[] }>;
		                                  
		const onDidChangeActiveColorTheme: Event<ColorTheme>;
		                                                                                    
		function showInformationMessage<T extends string | MessageItem>(message: string, ...items: T[]): Promise<T | undefined>;
		                                              
		function showInformationMessage<T extends string | MessageItem>(message: string, options: MessageOptions, ...items: T[]): Promise<T | undefined>;
		                    
		function showWarningMessage<T extends string | MessageItem>(message: string, ...items: T[]): Promise<T | undefined>;
		                               
		function showWarningMessage<T extends string | MessageItem>(message: string, options: MessageOptions, ...items: T[]): Promise<T | undefined>;
		                   
		function showErrorMessage<T extends string | MessageItem>(message: string, ...items: T[]): Promise<T | undefined>;
		                              
		function showErrorMessage<T extends string | MessageItem>(message: string, options: MessageOptions, ...items: T[]): Promise<T | undefined>;
		                                                                      
		function showQuickPick<T extends QuickPickItem | string>(items: readonly T[] | Promise<readonly T[]>, options?: QuickPickOptions, token?: CancellationToken): Promise<T | T[] | undefined>;
		                                                       
		function showInputBox(options?: InputBoxOptions, token?: CancellationToken): Promise<string | undefined>;
		                                  
		function createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem;
		                                                 
		function createStatusBarItem(id: string, alignment?: StatusBarAlignment, priority?: number): StatusBarItem;
		                                         
		function setStatusBarMessage(text: string, hideAfterTimeoutOrPromise?: number | Promise<any>): Disposable;
		                                             
		function withProgress<R>(options: ProgressOptions, task: (progress: Progress<{ message?: string; increment?: number }>, token: CancellationToken) => Promise<R>): Promise<R>;
		                                   
		function showTextDocument(document: TextDocument | Uri | string, options?: { viewColumn?: ViewColumn; preserveFocus?: boolean; preview?: boolean; selection?: Range }): Promise<TextEditor>;
		                                              
		function createTextEditorDecorationType(options: DecorationRenderOptions): TextEditorDecorationType;
		                                         
		function createOutputChannel(name: string): OutputChannel;
		                                                       
		function createWebviewPanel(viewType: string, title: string, showOptions: ViewColumn | { viewColumn: ViewColumn; preserveFocus?: boolean }, options?: WebviewOptions): WebviewPanel;
		                                                                        
		function registerWebviewViewProvider(viewId: string, provider: WebviewViewProvider, options?: { webviewOptions?: { retainContextWhenHidden?: boolean } }): Disposable;
	}

	                                                               
	namespace workspace {
		                                      
		const fs: FileSystem;
		                             
		const name: string;
		                                           
		const workspaceFolders: readonly WorkspaceFolder[] | undefined;
		                          
		const textDocuments: readonly TextDocument[];
		                                                       
		const projects: readonly ProjectInfo[];
		                                          
		const onDidChangeConfiguration: Event<ConfigurationChangeEvent>;
		                        
		const onDidOpenTextDocument: Event<TextDocument>;
		                          
		const onDidChangeTextDocument: Event<TextDocumentChangeEvent>;
		                         
		const onDidCloseTextDocument: Event<TextDocument>;
		                       
		const onDidSaveTextDocument: Event<TextDocument>;
		                        
		const onDidCreateFiles: Event<{ files: readonly Uri[] }>;
		                         
		const onDidDeleteFiles: Event<{ files: readonly Uri[] }>;
		                           
		const onDidRenameFiles: Event<{ files: readonly { oldUri: Uri; newUri: Uri }[] }>;
		                      
		const onDidOpenProject: Event<ProjectInfo>;
		                       
		const onDidCloseProject: Event<ProjectInfo>;
		                             
		const onDidChangeActiveProject: Event<ProjectInfo>;
		                                           
		function readFile(path: Uri | string): Promise<string>;
		                                              
		function writeFile(path: Uri | string, content: string): Promise<void>;
		                               
		function stat(path: Uri | string): Promise<FileStat>;
		                                 
		function findFiles(include: string, exclude?: string, maxResults?: number): Promise<Uri[]>;
		                                                          
		function findFilePaths(include: string, exclude?: string, maxResults?: number): Promise<string[]>;
		                                 
		function openTextDocument(uri: Uri | string): Promise<TextDocument>;
		                                                             
		function getConfiguration(section?: string): WorkspaceConfiguration;
		                                                                
		function applyEdit(edit: WorkspaceEdit, options?: { label?: string }): Promise<boolean>;
		                                 
		function createFileSystemWatcher(globPattern: string, ignoreCreateEvents?: boolean, ignoreChangeEvents?: boolean, ignoreDeleteEvents?: boolean): FileSystemWatcher;
		                                        
		function asRelativePath(pathOrUri: string | Uri, includeWorkspaceFolder?: boolean): string;
		                                   
		function getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined;
		                                                 
		function listProjects(): Promise<ProjectInfo[]>;
	}

	                                                          
	namespace languages {
		                                                           
		function registerCompletionItemProvider(selector: DocumentSelector, provider: CompletionItemProvider, ...triggerCharacters: string[]): Disposable;
		                      
		function registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable;
		                          
		function registerDefinitionProvider(selector: DocumentSelector, provider: DefinitionProvider): Disposable;
		                           
		function registerDocumentFormattingEditProvider(selector: DocumentSelector, provider: DocumentFormattingEditProvider): Disposable;
		                                
		function registerCodeActionsProvider(selector: DocumentSelector, provider: CodeActionProvider, metadata?: { providedCodeActionKinds?: readonly CodeActionKind[] }): Disposable;
		                                      
		function registerDocumentSymbolProvider(selector: DocumentSelector, provider: DocumentSymbolProvider): Disposable;
		                                    
		function createDiagnosticCollection(name?: string): DiagnosticCollection;
		                                                                          
		function setLanguageConfiguration(languageId: string, configuration: LanguageConfiguration): Disposable;
		                                    
		function getLanguages(): Promise<string[]>;
		                                                                       
		function match(selector: DocumentSelector, document: TextDocument): number;
	}

	                                                                  
	namespace preview {
		                                                 
		const onDidReload: Event<{ projectId: string | null; projectName: string; mode: string; url: string }>;
		                                                
		function injectScript(source: string): Promise<void>;
		                                                       
		function reload(options?: { full?: boolean }): Promise<void>;
		                       
		function setViewport(options: PreviewViewport | string): Promise<void>;
		                           
		function getViewport(): Promise<Required<PreviewViewport>>;
		                    
		function getState(): Promise<PreviewState>;
	}

	                                                       
	namespace keybindings {
		                                          
		function list(): { command: string; binding: string; when?: string }[];
		                                                  
		function bindingFor(command: string): string;
	}

	                                                                                           
	interface McpToolDefinition {
		                                                                                                          
		name: string;
		title?: string;
		description?: string;
		                                  
		inputSchema?: Record<string, unknown>;
		                                                                                
		handler: (args: Record<string, unknown>) => unknown | Promise<unknown>;
	}

	                                                                                             
	namespace mcp {
		function registerTool(definition: McpToolDefinition): Disposable;
		                                                                                            
		function registerTool(name: string, handler: McpToolDefinition['handler'], options?: Omit<McpToolDefinition, 'name' | 'handler'>): Disposable;
		function listTools(): Promise<Array<{ name: string; publicName: string }>>;
	}

	                       
	namespace env {
		                                                    
		const language: string;
		                                        
		const appRoot: string;
		                                                                                       
		const apiVersion: string;
		                     
		const appVersion: string;
		                         
		const appName: string;
		                              
		const uiKind: 'desktop' | 'celular';
		                                   
		const isMobile: boolean;
		                             
		const clipboard: Clipboard;
		                                                       
		function openExternal(target: Uri | string): Promise<boolean>;
	}

	                                     
	interface TestCaseResult {
		                                      
		readonly name: string;
		                                       
		readonly status: 'passed' | 'failed' | 'skipped';
		                     
		readonly durationMs: number;
		                                      
		readonly error?: string;
	}

	                                           
	interface TestReport {
		                      
		readonly total: number;
		                 
		readonly passed: number;
		                  
		readonly failed: number;
		               
		readonly skipped: number;
		                           
		readonly durationMs: number;
		                         
		readonly cases: readonly TestCaseResult[];
	}

	                                                          
	interface Expectation<T> {
		                                  
		readonly not: Expectation<T>;
		                                       
		toBe(expected: T): void;
		                                     
		toEqual(expected: any): void;
		                    
		toBeTruthy(): void;
		                   
		toBeFalsy(): void;
		                                
		toBeDefined(): void;
		                           
		toBeUndefined(): void;
		                      
		toBeNull(): void;
		                                  
		toContain(item: any): void;
		                      
		toHaveLength(length: number): void;
		                 
		toBeGreaterThan(value: number): void;
		                 
		toBeLessThan(value: number): void;
		                                   
		toMatch(pattern: RegExp | string): void;
		                                                          
		toThrow(expected?: RegExp | string): void;
		                                                             
		rejects(expected?: RegExp | string): Promise<void>;
		                       
		resolves(): Promise<void>;
	}

	                                                                                               
	namespace test {
		                    
		function describe(name: string, body: () => void): void;
		                                           
		function it(name: string, body: () => any | Promise<any>): void;
		                     
		function test(name: string, body: () => any | Promise<any>): void;
		                   
		function skip(name: string, body?: () => any): void;
		                                                 
		function beforeEach(body: () => any | Promise<any>): void;
		                                                  
		function afterEach(body: () => any | Promise<any>): void;
		                                            
		function beforeAll(body: () => any | Promise<any>): void;
		                                             
		function afterAll(body: () => any | Promise<any>): void;
		                                    
		function expect<T>(actual: T): Expectation<T>;
		                                                                            
		function run(): Promise<TestReport>;
	}
}

                                                                    
declare function require(module: 'synapse' | 'vscode'): typeof synapse;
                                                                             
declare var module: { exports: { activate?(context: synapse.ExtensionContext): any; deactivate?(): any; [key: string]: any } };
                                    
declare var exports: typeof module.exports;


                                                                                                            
declare module 'synapse' {
	export = synapse;
}
                                                                      
declare module 'vscode' {
	export = synapse;
}
