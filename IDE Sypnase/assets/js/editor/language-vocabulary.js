(function () {
    'use strict';

    const sources = {
      csharp: {
        keywords:
        'abstract as async await base bool break byte case catch char checked class const continue decimal default delegate do double dynamic else enum event explicit extern false finally fixed float for foreach get goto if implicit in init int interface internal is lock long namespace new null object operator out override params partial private protected public readonly record ref return sbyte sealed set short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using var virtual void volatile when where while yield',
        globals:
        'Action Array Attribute Boolean Byte Char Console Convert DateTime Debug Decimal Dictionary Directory Double Encoding Enumerable Environment Exception File Func GameObject Guid HashSet HttpClient IDisposable IEnumerable IList Input Int32 Int64 JsonSerializer KeyValuePair List Math Mathf MonoBehaviour Nullable Object Path Process Queue Quaternion Random Regex Single Stack Stopwatch Stream String StringBuilder Task Thread Time TimeSpan Transform Tuple Type Uri Vector2 Vector3',
        members: {
          common:
          'Add AddRange All Any Append Clear Contains ContainsKey Count Distinct ElementAt Equals First FirstOrDefault ForEach GetHashCode GetType IndexOf Insert Key Last LastOrDefault Length Max Min OrderBy OrderByDescending Remove RemoveAll RemoveAt Reverse Select SelectMany Single Skip Split Sum Take ToArray ToDictionary ToList ToLower ToString ToUpper Trim TryGetValue Value Where',
          Console:
          'BackgroundColor Beep Clear Error ForegroundColor In Out ReadKey ReadLine ResetColor Title Write WriteLine',
          Math: 'Abs Acos Asin Atan Atan2 Ceiling Clamp Cos E Exp Floor Log Log10 Max Min PI Pow Round Sign Sin Sqrt Tan Truncate',
          Mathf:
          'Abs Approximately Ceil Clamp Clamp01 Cos Deg2Rad Epsilon Floor Infinity Lerp Max Min MoveTowards PI Pow Rad2Deg Repeat Round Sign Sin SmoothStep Sqrt Tan',
          String: 'Compare Concat Copy Empty Equals Format IsNullOrEmpty IsNullOrWhiteSpace Join',
          File: 'AppendAllText Copy Create Delete Exists Move ReadAllBytes ReadAllLines ReadAllText WriteAllBytes WriteAllLines WriteAllText',
          Directory: 'CreateDirectory Delete Exists GetCurrentDirectory GetDirectories GetFiles Move',
          Path: 'ChangeExtension Combine GetDirectoryName GetExtension GetFileName GetFileNameWithoutExtension GetFullPath GetTempPath',
          Task: 'CompletedTask Delay FromResult Run WhenAll WhenAny Yield',
          Convert: 'ToBase64String ToBoolean ToDateTime ToDecimal ToDouble ToInt32 ToInt64 ToSingle ToString',
          DateTime: 'MaxValue MinValue Now Parse Today TryParse UtcNow',
          Debug: 'Assert Break DrawLine DrawRay Log LogError LogWarning',
          Guid: 'Empty NewGuid Parse TryParse',
        },
      },
      luau: {
        keywords:
        'and break continue do else elseif end export false for function if in local nil not or repeat return then true type typeof until while',
        globals:
        'assert bit32 buffer coroutine debug error game getfenv getmetatable ipairs math newproxy next os pairs pcall print rawequal rawget rawlen rawset require script select setmetatable shared string table task tick time tonumber tostring type typeof unpack utf8 warn workspace xpcall Axes BrickColor CFrame Color3 ColorSequence DateTime Enum Faces Instance NumberRange NumberSequence PhysicalProperties Random Ray Rect Region3 TweenInfo UDim UDim2 Vector2 Vector3',
        members: {
          common:
          'Anchored AncestryChanged Archivable BrickColor CFrame CanCollide CanQuery CanTouch ChildAdded ChildRemoved ClassName Clone Color Connect Destroy Disconnect Enabled FireAllClients FireClient FireServer FindFirstAncestor FindFirstChild FindFirstChildOfClass FindFirstChildWhichIsA GetAttribute GetChildren GetDescendants GetFullName GetPropertyChangedSignal Invoke IsA IsDescendantOf Material Name Once OnClientEvent OnServerEvent Orientation Parent PivotTo Position Rotation SetAttribute Size Touched Transparency Value Wait WaitForChild',
          game: 'BindToClose FindService GameId GetService IsLoaded JobId Lighting Loaded PlaceId Players ReplicatedStorage ServerScriptService ServerStorage StarterGui StarterPlayer Workspace',
          workspace:
          'Blockcast CurrentCamera FindFirstChild GetChildren GetPartsInPart Gravity Raycast Shapecast Terrain WaitForChild',
          script: 'Disabled Enabled GetFullName Name Parent RunContext Source',
          string: 'byte char find format gmatch gsub len lower match pack rep reverse split sub unpack upper',
          table: 'clear clone concat create find freeze insert isfrozen move pack remove sort unpack',
          math: 'abs acos asin atan atan2 ceil clamp cos deg exp floor fmod huge log log10 max min modf noise pi pow rad random randomseed round sign sin sqrt tan',
          task: 'cancel defer delay desynchronize spawn synchronize wait',
          os: 'clock date difftime time',
          coroutine: 'close create isyieldable resume running status wrap yield',
          utf8: 'char charpattern codepoint codes graphemes len nfcnormalize nfdnormalize offset',
          Instance: 'fromExisting new',
          Vector3: 'Angle Cross Dot FromAxis FromNormalId Lerp Magnitude Unit new one xAxis yAxis zAxis zero',
          Vector2: 'Cross Dot Lerp Magnitude Unit new one xAxis yAxis zero',
          CFrame:
          'Angles Inverse Lerp LookVector Position RightVector ToObjectSpace ToOrientation ToWorldSpace UpVector fromAxisAngle fromEulerAngles fromEulerAnglesXYZ fromMatrix identity lookAlong lookAt new',
          Color3: 'B G Lerp R fromHSV fromHex fromRGB new toHSV toHex',
          UDim2: 'fromOffset fromScale new',
          UDim: 'new',
          Enum: 'AutomaticSize EasingDirection EasingStyle FillDirection Font HumanoidStateType KeyCode Material NormalId PartType PlaybackState RaycastFilterType ScaleType SortOrder TextXAlignment TextYAlignment UserInputType',
          Players: 'GetPlayerFromCharacter GetPlayers LocalPlayer PlayerAdded PlayerRemoving',
          TweenService: 'Create GetValue',
          RunService: 'BindToRenderStep Heartbeat IsClient IsServer IsStudio RenderStepped Stepped',
          UserInputService:
          'GetMouseLocation InputBegan InputChanged InputEnded IsKeyDown KeyboardEnabled TouchEnabled',
          Random: 'Clone NextInteger NextNumber NextUnitVector Shuffle new',
        },
      },
      python: {
        keywords:
        'and as assert async await break case class continue def del elif else except False finally for from global if import in is lambda match None nonlocal not or pass raise return True try while with yield',
        globals:
        'abs all any bin bool bytes callable chr classmethod cls dict dir divmod enumerate eval filter float format frozenset getattr hasattr hash hex id input int isinstance issubclass iter len list map max min next object open ord pow print property range repr reversed round self set setattr slice sorted staticmethod str sum super tuple type vars zip',
        members: {
          common:
          'append clear close copy count decode encode endswith extend find format get index insert items join keys lower lstrip pop read remove replace reverse rstrip sort split startswith strip title update upper values write',
          os: 'environ getcwd listdir makedirs mkdir path remove rename system walk',
          json: 'dump dumps load loads',
          re: 'compile findall fullmatch match search split sub',
          math: 'ceil cos e fabs floor inf isnan log log10 pi pow sin sqrt tan',
          sys: 'argv exit path platform stderr stdin stdout version',
        },
      },
      java: {
        keywords:
        'abstract assert boolean break byte case catch char class const continue default do double else enum extends false final finally float for goto if implements import instanceof int interface long native new null package private protected public record return sealed short static strictfp super switch synchronized this throw throws transient true try var void volatile while',
        globals:
        'ArrayList Arrays Boolean Character Collections Comparator Double Exception File Float HashMap HashSet Integer Iterable List LocalDate LocalDateTime Long Map Math Object Optional Runnable Set Stream String StringBuilder System Thread UUID',
        members: {
          common:
          'add addAll charAt clear collect contains containsKey equals filter forEach get getKey getValue hashCode indexOf isEmpty iterator join keySet length map put putAll remove replace set size sort stream substring toLowerCase toString toUpperCase trim values',
          System: 'arraycopy currentTimeMillis err exit getProperty getenv in lineSeparator nanoTime out',
          Math: 'E PI abs ceil floor max min pow random round sqrt',
          Arrays: 'asList copyOf equals fill sort stream toString',
          Collections: 'emptyList max min reverse shuffle singletonList sort unmodifiableList',
          String: 'format join valueOf',
          Optional: 'empty of ofNullable',
        },
      },
      kotlin: {
        keywords:
        'as break by catch class companion const constructor continue crossinline data do else enum external false final finally for fun get if import in infix init inline interface internal is lateinit noinline null object open operator out override package private protected public reified return sealed set super suspend this throw true try typealias val var vararg when where while',
        globals:
        'ArrayList Boolean Char Double Exception Float Int List Long Map MutableList MutableMap Pair Set String Triple Unit also apply arrayOf buildString check emptyList error hashMapOf lazy let listOf mapOf mutableListOf mutableMapOf print println repeat require run setOf takeIf with',
        members: {
          common:
          'add all any associateBy contains count filter first firstOrNull flatMap forEach get groupBy indexOf isEmpty isNotEmpty joinToString last map maxOrNull minOrNull plus remove size sortedBy split sumOf take toList toMutableList toString trim',
        },
      },
      swift: {
        keywords:
        'as associatedtype async await break case catch class continue default defer deinit do else enum extension fallthrough false fileprivate final for func guard if import in indirect init inout internal is lazy let mutating nil open operator override private protocol public repeat rethrows return self static struct subscript super switch throw throws true try typealias var weak where while',
        globals:
        'Any AnyObject Array Bool Character Codable Data Date Dictionary Double Error Float Int Optional Result Set String UInt URL Void abs max min print zip',
        members: {
          common:
          'append compactMap contains count filter first flatMap forEach index insert isEmpty joined last map reduce remove removeAll sorted split trimmingCharacters uppercased lowercased',
        },
      },
      cpp: {
        keywords:
        'alignas auto bool break case catch char class const constexpr continue decltype default delete do double else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept nullptr operator private protected public register return short signed sizeof static static_assert struct switch template this throw true try typedef typeid typename union unsigned using virtual void volatile while',
        globals:
        'array cerr cin cout deque endl fclose fopen fprintf free int32_t int64_t list make_shared make_unique malloc map memcpy memset nullptr optional pair printf queue scanf set shared_ptr size_t stack std string strlen uint32_t uint64_t unique_ptr unordered_map unordered_set vector',
        members: {
          common:
          'append at back begin c_str clear count data emplace_back empty end erase find first front insert length pop_back push_back rbegin rend reserve resize second size substr swap',
          std: 'array cerr cin cout endl find function getline make_pair make_shared make_unique map max min move optional pair set sort stod stoi string swap to_string vector',
        },
      },
      go: {
        keywords:
        'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var',
        globals:
        'append bool byte cap close complex context copy delete errors false float32 float64 fmt int int16 int32 int64 int8 io iota json len make math new nil os panic print println recover regexp rune sort strconv string strings sync time true uint uintptr',
        members: {
          common: 'Close Error Len Read String Write',
          fmt: 'Errorf Fprintf Print Printf Println Scan Scanln Sprint Sprintf Sscanf',
          strings:
          'Contains ContainsAny Count Fields HasPrefix HasSuffix Index Join NewReader Repeat Replace ReplaceAll Split Title ToLower ToTitle ToUpper Trim TrimPrefix TrimSpace TrimSuffix',
          strconv: 'Atoi FormatFloat FormatInt Itoa ParseBool ParseFloat ParseInt Quote',
          os: 'Args Create Exit Getenv Mkdir MkdirAll Open OpenFile ReadFile Remove RemoveAll Rename Setenv Stat Stderr Stdin Stdout WriteFile',
          time: 'After Duration Hour Millisecond Minute NewTimer Now Parse Second Since Sleep Tick Unix',
          errors: 'As Is Join New Unwrap',
          json: 'Marshal MarshalIndent NewDecoder NewEncoder Unmarshal',
        },
      },
      rust: {
        keywords:
        'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self static struct super trait true type unsafe use where while',
        globals:
        'Arc BTreeMap Box Clone Copy Debug Default Drop Err HashMap HashSet Iterator None Ok Option Rc RefCell Result Some String Vec assert assert_eq bool char f32 f64 format i16 i32 i64 i8 isize matches panic print println str u16 u32 u64 u8 usize vec write writeln',
        members: {
          common:
          'as_bytes as_mut as_ref borrow chars clone cloned collect contains count enumerate expect filter filter_map find flat_map fold get insert into into_iter is_empty is_none is_some iter iter_mut join len map map_err next ok_or parse push push_str remove rev sort sort_by split take to_owned to_string trim unwrap unwrap_or unwrap_or_default unwrap_or_else zip',
        },
      },
      dart: {
        keywords:
        'abstract as assert async await break case catch class const continue covariant default deferred do dynamic else enum export extends extension external factory false final finally for get if implements import in interface is late library mixin new null on operator part required rethrow return sealed set show static super switch sync this throw true try typedef var void while with yield',
        globals:
        'BuildContext Column Container DateTime Duration Exception Future List Map Object Row Scaffold Set StatefulWidget StatelessWidget Stream String Text Widget bool double dynamic int num print runApp',
        members: {
          common:
          'add addAll contains firstWhere forEach indexOf isEmpty isNotEmpty join length map remove removeAt setState substring toList toLowerCase toString toUpperCase trim where',
        },
      },
      php: {
        keywords:
        'abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enum extends false final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match namespace new null or print private protected public readonly require require_once return static switch throw trait true try unset use var while xor yield',
        globals:
        'array_filter array_key_exists array_keys array_map array_merge array_pop array_push array_reverse array_search array_shift array_slice array_sum array_unique array_values count date define defined dirname explode file_exists file_get_contents file_put_contents implode in_array intval is_array is_null is_numeric is_string json_decode json_encode ksort number_format preg_match preg_replace preg_split printf round sprintf str_contains str_pad str_repeat str_replace str_split strlen strpos strtolower strtotime strtoupper substr trim usort var_dump',
        members: {},
      },
      ruby: {
        keywords:
        'alias and begin break case class def defined? do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield',
        globals:
        'attr_accessor attr_reader attr_writer freeze gets include lambda loop new p print proc puts raise require require_relative sleep',
        members: {
          common:
          'capitalize chomp count downcase each each_with_index empty? end_with? fetch find first group_by gsub include? inject join keys last length map merge nil? pop push reduce reject select shift size sort sort_by split start_with? strip sub to_a to_f to_i to_s to_sym unshift upcase values',
        },
      },
      sql: {
        keywords:
        'ADD ALL ALTER AND AS ASC BETWEEN BY CASE CAST CHECK COLUMN CONSTRAINT CREATE CROSS DEFAULT DELETE DESC DISTINCT DROP ELSE END EXISTS FOREIGN FROM FULL GROUP HAVING IF IN INDEX INNER INSERT INTO IS JOIN KEY LEFT LIKE LIMIT NOT NULL OFFSET ON OR ORDER OUTER PRIMARY REFERENCES RETURNING RIGHT SELECT SET TABLE THEN UNION UNIQUE UPDATE USING VALUES VIEW WHEN WHERE WITH',
        globals:
        'AVG COALESCE CONCAT COUNT CURRENT_DATE CURRENT_TIMESTAMP DATE DATETIME GROUP_CONCAT IFNULL JSON_EXTRACT LENGTH LOWER MAX MIN NOW NULLIF RANDOM REPLACE ROUND SUBSTR SUM TRIM UPPER',
        members: {},
      },
      shell: {
        keywords:
        'break case continue do done elif else esac fi for function if in return select then until while',
        globals:
        'awk basename cat cd chmod chown cp curl cut date df diff dirname docker du echo env exit export find git grep gzip head kill ln local ls make mkdir mv node npm npx pip3 printf ps pwd python3 read readonly rm rmdir sed set sleep sort source ssh tail tar test touch tr uniq unset unzip wc wget xargs zip',
        members: {},
      },
      powershell: {
        keywords:
        'begin break catch class continue data do dynamicparam else elseif end enum exit filter finally for foreach function if in param process return switch throw trap try until while',
        globals:
        'Add-Content Compare-Object ConvertFrom-Json ConvertTo-Json Copy-Item Get-ChildItem Get-Content Get-Date Get-Location Get-Member Get-Process Invoke-RestMethod Invoke-WebRequest Join-Path Measure-Object New-Item Out-File Remove-Item Rename-Item Select-Object Set-Content Set-Location Sort-Object Start-Process Test-Path Where-Object Write-Error Write-Host Write-Output',
        members: {},
      },
      yaml: { keywords: 'false no null off on true yes', globals: '', members: {} },
    };

    function wordsOf(text) {
      return Object.freeze(String(text || '').split(' ').filter(Boolean));
    }

    function buildMembers(members) {
      const entries = Object.entries(members || {}).map(([receiver, list]) => [receiver, wordsOf(list)]);
      return Object.freeze(Object.fromEntries(entries));
    }

    const emptyList = Object.freeze([]);

    const vocabularies = Object.freeze(
      Object.fromEntries(
        Object.entries(sources).map(([languageId, entry]) => [
            languageId,
            Object.freeze({
                keywords: wordsOf(entry.keywords),
                globals: wordsOf(entry.globals),
                members: buildMembers(entry.members),
            }),
        ]),
      ),
    );

    function keywordsFor(languageId) {
      return vocabularies[languageId] ? vocabularies[languageId].keywords : emptyList;
    }

    function globalsFor(languageId) {
      return vocabularies[languageId] ? vocabularies[languageId].globals : emptyList;
    }

    function membersFor(languageId, receiverName) {
      const entry = vocabularies[languageId];
      if (!entry) return emptyList;
      const specific = entry.members[receiverName] || emptyList;
      const shared = entry.members.common || emptyList;
      return specific.concat(shared);
    }

    function hasVocabulary(languageId) {
      return !!vocabularies[languageId];
    }

    window.SynapseLanguageVocabulary = Object.freeze({
        keywordsFor,
        globalsFor,
        membersFor,
        hasVocabulary,
    });
})();
