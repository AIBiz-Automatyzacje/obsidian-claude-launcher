'use strict';

const { Plugin, PluginSettingTab, Setting, addIcon, Notice } = require('obsidian');

// Maskotka Claude Code — pixel art 16x10, viewBox 0 0 100 100, wycentrowana pionowo.
const MASCOT = '<rect x="12.5" y="18.75" width="75" height="6.25" fill="#c15f3c"/><rect x="12.5" y="25" width="75" height="6.25" fill="#c15f3c"/><rect x="12.5" y="31.25" width="12.5" height="6.25" fill="#c15f3c"/><rect x="31.25" y="31.25" width="37.5" height="6.25" fill="#c15f3c"/><rect x="75" y="31.25" width="12.5" height="6.25" fill="#c15f3c"/><rect x="12.5" y="37.5" width="12.5" height="6.25" fill="#c15f3c"/><rect x="31.25" y="37.5" width="37.5" height="6.25" fill="#c15f3c"/><rect x="75" y="37.5" width="12.5" height="6.25" fill="#c15f3c"/><rect x="0" y="43.75" width="100" height="6.25" fill="#c15f3c"/><rect x="0" y="50" width="100" height="6.25" fill="#c15f3c"/><rect x="12.5" y="56.25" width="75" height="6.25" fill="#c15f3c"/><rect x="12.5" y="62.5" width="75" height="6.25" fill="#c15f3c"/><rect x="18.75" y="68.75" width="6.25" height="6.25" fill="#c15f3c"/><rect x="31.25" y="68.75" width="6.25" height="6.25" fill="#c15f3c"/><rect x="62.5" y="68.75" width="6.25" height="6.25" fill="#c15f3c"/><rect x="75" y="68.75" width="6.25" height="6.25" fill="#c15f3c"/><rect x="18.75" y="75" width="6.25" height="6.25" fill="#c15f3c"/><rect x="31.25" y="75" width="6.25" height="6.25" fill="#c15f3c"/><rect x="62.5" y="75" width="6.25" height="6.25" fill="#c15f3c"/><rect x="75" y="75" width="6.25" height="6.25" fill="#c15f3c"/>';

const TERMINAL_PLUGIN_ID = 'terminal';
const PROFILE_ID = 'claude-code-launcher';
const PROFILE_NAME = 'Claude Code';

const DEFAULT_SETTINGS = {
  command: 'claude',
  skipPermissions: false,
  cwd: 'root',
};

// Terminal domyślnie startuje z followTheme, czyli podmienia paletę ANSI kolorami
// motywu Obsidiana. Efekt: u każdego kursanta te same sekwencje kolorów wychodzą
// inaczej, a przy motywach z jasnym tłem bloki Claude'a tracą ciemne podświetlenie.
// Dlatego wyłączamy followTheme i podajemy własną, stałą paletę.
const TERMINAL_THEME = {
  background: '#1a1a1a',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  cursorAccent: '#1a1a1a',
  selectionBackground: '#3a4a5a',
  black: '#1a1a1a',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#d4d4d4',
  brightBlack: '#5c6370',
  brightRed: '#e06c75',
  brightGreen: '#98c379',
  brightYellow: '#e5c07b',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
  brightWhite: '#ffffff',
};

// Opcje lecą surowe do konstruktora xterma. fontFamily jest tu najważniejsze:
// bez niego terminal dziedziczy czcionkę z motywu Obsidiana, a jeśli ta nie ma
// stałej szerokości znaku, cała siatka terminala rozjeżdża się i tekst nachodzi
// na siebie. minimumContrastRatio: 1 wyłącza automatyczne „poprawianie" kolorów
// przez xterm, żeby paleta wyżej była tym, co użytkownik faktycznie widzi.
const TERMINAL_OPTIONS = {
  documentOverride: null,
  fontFamily: '"Cascadia Mono", Consolas, Menlo, "DejaVu Sans Mono", monospace',
  fontSize: 13,
  lineHeight: 1.1,
  letterSpacing: 0,
  minimumContrastRatio: 1,
  drawBoldTextInBrightColors: true,
  scrollback: 5000,
  theme: TERMINAL_THEME,
};

// Fallbackowy rozmiar konsoli, gdy nie da się zmierzyć panelu. Lepszy punkt
// startowy niż domyślne 80x25 conhosta, na którym TUI Claude'a się łamie.
const FALLBACK_CONSOLE_SIZE = { cols: 120, rows: 30 };
const CONSOLE_SIZE_LIMITS = { minCols: 60, maxCols: 240, minRows: 20, maxRows: 80 };

// Ile ms spokoju po ostatniej zmianie rozmiaru panelu, zanim ruszymy konsolę.
const RESIZE_SETTLE_MS = 120;

// Po starcie sesji czekamy, aż Claude skończy rysować (tyle ms ciszy w wyjściu),
// i wtedy poruszamy konsolą o jedną kolumnę. Pilnujemy tylko początku sesji
// i najwyżej kilka razy — potem rozmiar trzyma już zwykły resize panelu.
const STARTUP_QUIET_MS = 800;
const STARTUP_WATCH_MS = 20000;
const STARTUP_MAX_NUDGES = 2;
// Ile ms konsola stoi o kolumnę węższa, zanim wróci do rozmiaru xterma.
const NUDGE_RESTORE_MS = 250;

// Co ile ms sprawdzamy, czy w workspace pojawił się terminal z naszym profilem bez
// resizera — np. przywrócony po restarcie Obsidiana.
const RESIZER_SCAN_MS = 1500;

const LINK_HANDLER = {
  activate(event, uri) {
    if (!/^https?:\/\//i.test(uri)) return;
    try {
      require('electron').shell.openExternal(uri);
    } catch (error) {
      console.error('[claude-launcher] nie udało się otworzyć linku', uri, error);
    }
  },
};

function currentPlatform() {
  const fromProcess = typeof process !== 'undefined' ? process.platform : null;
  if (fromProcess === 'darwin' || fromProcess === 'win32' || fromProcess === 'linux') {
    return fromProcess;
  }
  const ua = self.navigator.userAgent;
  if (ua.includes('Mac')) return 'darwin';
  if (ua.includes('Win')) return 'win32';
  return 'linux';
}

// Windows 10 i 11 zgłaszają się jako 10.0.x — rozróżnia je dopiero numer kompilacji.
function isWindows10() {
  try {
    const build = parseInt(require('os').release().split('.')[2], 10);
    return build > 0 && build < 22000;
  } catch (error) {
    return false;
  }
}

function fullCommand(settings) {
  // Podłączenie do istniejącej sesji w tle (link obsidian://claude-launcher?attach=<id>)
  if (settings.attach) return `${settings.command.trim() || 'claude'} attach ${settings.attach}`;
  const flags = settings.skipPermissions ? ' --dangerously-skip-permissions' : '';
  return `${settings.command.trim() || 'claude'}${flags}`;
}

// Na Windowsie Claude siedzi w conhoście, a plugin Terminal skaluje go pomocniczym
// skryptem Pythona (psutil + pywinctl). Kto nie ma Pythona z tymi bibliotekami — a
// to domyślny stan świeżego Windowsa — dostaje terminal, w którym xterm dopasowuje
// się do panelu, a konsola zostaje na 80 kolumnach. Claude rysuje wtedy interfejs
// dla jednej szerokości, xterm wyświetla go w innej i ramki lądują w losowych
// miejscach. Zamiast wymagać instalacji Pythona robimy to samo w PowerShellu,
// który jest na każdym Windowsie.
//
// Protokół jest nasz własny (Terminal ma swój, ale jest przywiązany do `-c` Pythona):
// pierwsza linia na stdin to PID procesu konsoli, każda kolejna to `KOLUMNYxWIERSZE`.
const RESIZER_PS = `
$ErrorActionPreference = 'Stop'
# Try na całym ciele skryptu: bez niego błąd terminujący (np. Add-Type na maszynie
# bez kompilatora) ląduje w strumieniu błędów silnika PowerShella, a ten przy
# przekierowanym stderr serializuje go do CLIXML — w logu launchera widać wtedy
# tylko nagłówek "#< CLIXML" zamiast przyczyny. [Console]::Error pisze surowo,
# z pominięciem serializacji.
try {
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ClResizer {
  [StructLayout(LayoutKind.Sequential)] public struct COORD { public short X; public short Y; }
  [StructLayout(LayoutKind.Sequential)] public struct SMALL_RECT { public short Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct CSBI {
    public COORD Size; public COORD Cursor; public ushort Attributes; public SMALL_RECT Window; public COORD MaxWindow;
  }
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AttachConsole(uint pid);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool FreeConsole();
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetConsoleScreenBufferSize(IntPtr h, COORD size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetConsoleWindowInfo(IntPtr h, bool absolute, ref SMALL_RECT r);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetConsoleScreenBufferInfo(IntPtr h, out CSBI info);
  [DllImport("kernel32.dll")] static extern IntPtr GetConsoleWindow();
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Auto)]
  static extern IntPtr CreateFile(string name, uint access, uint share, IntPtr sec, uint disp, uint flags, IntPtr tmpl);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool CloseHandle(IntPtr h);
  [DllImport("user32.dll", SetLastError=true)] static extern bool GetClientRect(IntPtr w, out RECT r);
  [DllImport("user32.dll", SetLastError=true)] static extern bool GetWindowRect(IntPtr w, out RECT r);
  [DllImport("user32.dll", SetLastError=true)] static extern bool SetWindowPos(IntPtr w, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr w, out uint pid);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr ctx);

  // SWP_NOSIZE nie, SWP_NOMOVE | SWP_NOZORDER | SWP_NOREDRAW | SWP_NOACTIVATE — okno
  // konsoli jest ukryte i ma takie zostać, zmieniamy mu wyłącznie rozmiar.
  const uint SWP_FLAGS = 0x0002 | 0x0004 | 0x0008 | 0x0010;

  public static string LastError = "";
  public static uint LastHost = 0;

  static bool SetBuffer(IntPtr h, int cols, int rows) {
    COORD size; size.X = (short)cols; size.Y = (short)rows;
    return SetConsoleScreenBufferSize(h, size);
  }

  static bool SetWindow(IntPtr h, int cols, int rows) {
    SMALL_RECT r = new SMALL_RECT();
    r.Left = 0; r.Top = 0; r.Right = (short)(cols - 1); r.Bottom = (short)(rows - 1);
    return SetConsoleWindowInfo(h, true, ref r);
  }

  // Zwraca 0, gdy pod tym PID-em nie ma właściwej konsoli (szukaj dalej), 1, gdy konsola
  // ma docelowy rozmiar, i 2, gdy to właściwa konsola, ale rozmiar nie wszedł (powód w LastError).
  // host != 0 zawęża do konsoli, której okno należy do procesu conhosta z naszej sesji —
  // pod Claude'em mogą chodzić procesy z własnymi, obcymi konsolami.
  //
  // Std handles procesu wskazują na pipe'y od spawna, nie na konsolę, do której
  // się właśnie podłączyliśmy. Uchwyt konsoli bierzemy więc przez CONOUT$.
  public static int Resize(uint pid, int cols, int rows, uint host) {
    FreeConsole();
    if (!AttachConsole(pid)) return 0;
    IntPtr h = IntPtr.Zero;
    try {
      IntPtr hwnd = GetConsoleWindow();
      uint owner = 0;
      if (hwnd != IntPtr.Zero) GetWindowThreadProcessId(hwnd, out owner);
      LastHost = owner;
      if (host != 0 && owner != host) return 0;
      h = CreateFile("CONOUT$", 0xC0000000, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
      if (h == IntPtr.Zero || h == new IntPtr(-1)) return 0;

      // Conhost liczy okno w prawdziwych pikselach, a PowerShell nie jest DPI-aware:
      // przy skalowaniu ekranu (np. 125%) Windows podaje mu przeskalowane wymiary okna
      // i przeliczenie na kolumny chybia o jedną (zgłoszenie: „73x40 zamiast 72x40”).
      // Brak funkcji (Windows starszy niż 10 1607) zostawia stare zachowanie.
      try { SetThreadDpiAwarenessContext(new IntPtr(-4)); } catch (Exception) { }

      // Kilka przebiegów z poprawką: po każdej zmianie odczytujemy, ile kolumn faktycznie
      // wyszło, i korygujemy piksele o różnicę. Sama proporcja pikseli z poprzedniego
      // rozmiaru potrafiła utknąć kolumnę obok celu.
      int cellW = 0, cellH = 0, fixW = 0, fixH = 0;
      for (int pass = 0; pass < 4; pass++) {
        CSBI info;
        if (!GetConsoleScreenBufferInfo(h, out info)) {
          LastError = "GetConsoleScreenBufferInfo, kod " + Marshal.GetLastWin32Error();
          return 2;
        }
        int oldCols = info.Window.Right - info.Window.Left + 1;
        int oldRows = info.Window.Bottom - info.Window.Top + 1;
        if (oldCols == cols && oldRows == rows) return 1;

        // Gdy Claude pracuje na alternatywnym buforze ekranu (tryb pełnoekranowy,
        // claude agents), SetConsoleWindowInfo i SetConsoleScreenBufferSize odmawiają.
        // Wtedy działa tylko to, co zrobiłby użytkownik: zmiana rozmiaru samego okna
        // konsoli w pikselach. Okno jest ukryte, więc nikt tego nie zobaczy.
        RECT client, frame;
        if (hwnd != IntPtr.Zero && oldCols > 0 && oldRows > 0
            && GetClientRect(hwnd, out client) && GetWindowRect(hwnd, out frame)) {
          int clientW = client.Right - client.Left, clientH = client.Bottom - client.Top;
          int frameW = frame.Right - frame.Left, frameH = frame.Bottom - frame.Top;
          if (clientW > 0 && clientH > 0) {
            // Rozmiar komórki bierzemy z pierwszego odczytu: resztka pikseli poza pełnymi
            // kolumnami jest węższa od komórki, więc dzielenie całkowite trafia dokładnie.
            if (cellW == 0) {
              cellW = Math.Max(1, clientW / oldCols);
              cellH = Math.Max(1, clientH / oldRows);
            } else {
              fixW += (cols - oldCols) * cellW;
              fixH += (rows - oldRows) * cellH;
            }
            // Pół komórki zapasu, żeby okno nie wyszło o piksel za wąskie na ostatnią kolumnę.
            int w = cols * cellW + cellW / 2 + fixW + (frameW - clientW);
            int hgt = rows * cellH + cellH / 2 + fixH + (frameH - clientH);
            SetWindowPos(hwnd, IntPtr.Zero, 0, 0, w, hgt, SWP_FLAGS);
            // Conhost przelicza bufor po WM_SIZE; chwila oddechu, zanim go odczytamy.
            System.Threading.Thread.Sleep(30);
          }
        }

        // Bufor nie może być mniejszy od okna: przy zwężaniu najpierw okno, potem bufor,
        // przy poszerzaniu odwrotnie. Osobno dla kolumn i dla wierszy.
        if (oldCols < cols) { SetBuffer(h, cols, oldRows); SetWindow(h, cols, oldRows); }
        else { SetWindow(h, cols, oldRows); SetBuffer(h, cols, oldRows); }
        if (oldRows < rows) { SetBuffer(h, cols, rows); SetWindow(h, cols, rows); }
        else { SetWindow(h, cols, rows); SetBuffer(h, cols, rows); }
      }

      CSBI after;
      if (!GetConsoleScreenBufferInfo(h, out after)) {
        LastError = "GetConsoleScreenBufferInfo, kod " + Marshal.GetLastWin32Error();
        return 2;
      }
      int gotCols = after.Window.Right - after.Window.Left + 1;
      int gotRows = after.Window.Bottom - after.Window.Top + 1;
      if (gotCols == cols && gotRows == rows) return 1;
      LastError = "konsola ma " + gotCols + "x" + gotRows + " zamiast " + cols + "x" + rows
        + " (bufor " + after.Size.X + "x" + after.Size.Y + ", ostatni kod " + Marshal.GetLastWin32Error() + ")";
      return 2;
    } catch (Exception e) {
      LastError = e.Message;
      return 2;
    }
    finally {
      if (h != IntPtr.Zero && h != new IntPtr(-1)) CloseHandle(h);
      FreeConsole();
    }
  }
}
'@

# Strumień otwieramy raz i trzymamy, bo AttachConsole potrafi podmienić to,
# co [Console]::In zwróci później.
$reader = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$rootPid = 0
$target = 0
$lastReport = ''

# Ten sam błąd przy każdym resize zalałby konsolę devtools — zgłaszamy go raz,
# dopóki się nie zmieni albo rozmiar znowu nie wejdzie.
function Report([string] $message) {
  if ($message -ne $script:lastReport) {
    $script:lastReport = $message
    [Console]::Error.WriteLine($message)
  }
}

function Info([string] $message) {
  [Console]::Error.WriteLine("info: $message")
}

# Konsolę trzyma conhost, ale klientem jest dopiero cmd/powershell pod nim,
# więc szukamy w dół drzewa procesów, aż któryś da się podłączyć.
function Get-Candidates([int] $root) {
  $found = New-Object System.Collections.Generic.List[int]
  $found.Add($root)
  $queue = New-Object System.Collections.Generic.Queue[int]
  $queue.Enqueue($root)
  $guard = 0
  while ($queue.Count -gt 0 -and $guard -lt 32) {
    $guard++
    $parent = $queue.Dequeue()
    try {
      $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$parent" -ErrorAction SilentlyContinue
    } catch { $children = $null }
    foreach ($child in $children) {
      $childPid = [int] $child.ProcessId
      if (-not $found.Contains($childPid)) {
        $found.Add($childPid)
        $queue.Enqueue($childPid)
      }
    }
  }
  return $found
}

while ($null -ne ($line = $reader.ReadLine())) {
  $line = $line.Trim()
  if ($line -eq '') { continue }
  if ($rootPid -eq 0) {
    [void][int]::TryParse($line, [ref] $rootPid)
    continue
  }
  if ($line -notmatch '^(\\d+)x(\\d+)$') { continue }
  $cols = [int] $Matches[1]
  $rows = [int] $Matches[2]
  if ($cols -lt 20 -or $rows -lt 5 -or $cols -gt 1000 -or $rows -gt 1000) { continue }

  # Rozmiary lecą jako [int], nie [short] — akceleratora \`short\` nie ma w Windows
  # PowerShellu 5.1, a to on stoi na większości maszyn.
  # Try/catch obok: żaden pojedynczy błąd WinAPI nie ma prawa zamknąć resizera na
  # resztę sesji — użytkownik zostałby wtedy z konsolą w rozmiarze startowym.
  $status = 0
  if ($target -ne 0) {
    try { $status = [ClResizer]::Resize([uint32] $target, $cols, $rows, [uint32] 0) }
    catch { Report "resize failed: $_"; $status = 0 }
  }
  if ($status -eq 0) {
    # Wyszukiwanie odpala zapytania WMI, więc jest wolne — robimy je tylko wtedy,
    # gdy nie znamy jeszcze konsoli albo stara zniknęła, nigdy przy każdym resize.
    $target = 0
    $candidates = Get-Candidates $rootPid
    # Najpierw ściśle: konsola, której okno należy do conhosta z naszej sesji.
    # Luźny przebieg (dowolna konsola, ale tylko z potwierdzonym rozmiarem) zostaje
    # na wypadek, gdyby okno konsoli należało u kogoś do innego procesu.
    foreach ($hostPid in @([uint32] $rootPid, [uint32] 0)) {
      foreach ($candidate in $candidates) {
        try {
          $status = [ClResizer]::Resize([uint32] $candidate, $cols, $rows, $hostPid)
          if ($status -eq 1 -or ($status -eq 2 -and $hostPid -ne 0)) {
            $target = $candidate
            Info "konsola sesji: PID $candidate, okno konsoli należy do PID $([ClResizer]::LastHost)"
            break
          }
          $status = 0
        } catch { Report "resize failed: $_" }
      }
      if ($target -ne 0) { break }
    }
    if ($target -eq 0) { Report "nie znalazłem konsoli sesji (procesy: $($candidates -join ', '))" }
  }
  if ($status -eq 2) { Report "rozmiar nie wszedł: $([ClResizer]::LastError)" }
  if ($status -eq 1) { $lastReport = '' }
}
} catch {
  [Console]::Error.WriteLine("resizer crashed: $_")
  exit 1
}
`;

// PowerShell dostaje skrypt jako -EncodedCommand, żeby stdin został wolny na
// nasze komendy resize (przy -Command - skrypt zjadłby cały strumień wejściowy).
function encodePowerShellCommand(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

// powershell.exe z przekierowanymi strumieniami potrafi mimo -OutputFormat Text
// zserializować błędy silnika do CLIXML — w logu zostaje nagłówek "#< CLIXML"
// i nieczytelny XML. Wyciągamy z niego czysty tekst błędu, żeby konsola devtools
// pokazywała przyczynę awarii resizera, a nie opakowanie.
function decodeResizerStderr(line) {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed === '#< CLIXML') return '';
  if (!trimmed.includes('CLIXML') && !trimmed.startsWith('<Objs ')) return trimmed;
  const parts = [];
  const re = /<S S="(?:Error|Warning)"[^>]*>([^<]*)<\/S>/g;
  let match;
  while ((match = re.exec(trimmed))) {
    parts.push(
      match[1]
        .replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
    );
  }
  return parts.length ? parts.join('').trim() : trimmed;
}

// Kształt profilu 1:1 z tym, co plugin Terminal zapisuje w swoim data.json.
// Po wyjściu z Claude'a zostajemy w shellu (exec zsh / -NoExit), żeby terminal nie znikał.
function buildProfile(settings, pythonExecutable, consoleSize) {
  const platform = currentPlatform();
  const command = fullCommand(settings);
  const base = {
    environment: [],
    followTheme: false,
    name: PROFILE_NAME,
    platforms: { [platform]: true },
    pythonExecutable,
    restoreHistory: false,
    rightClickAction: 'copyPaste',
    successExitCodes: ['0', 'SIGINT', 'SIGTERM'],
    terminalOptions: TERMINAL_OPTIONS,
    type: 'integrated',
    useWin32Conhost: true,
  };

  // useWin32Conhost to na Windowsie jedyne źródło prawdziwej konsoli — Terminal zawsze
  // spawnuje ze `stdio: pipe`, więc bez conhosta proces nie ma TTY i Claude przechodzi
  // w tryb --print („Input must be provided either through stdin…").
  if (platform === 'win32') {
    // `mode con` ustawia konsolę od środka, zanim Claude zdąży cokolwiek narysować.
    // To punkt startowy oparty na zmierzonym panelu — dokładny rozmiar dołoży zaraz
    // potem resizer, ale gdyby ten nie wstał, sesja i tak nie zaczyna się od 80 kolumn.
    // Bez cudzysłowów świadomie: Terminal przepisuje argumenty do pliku .bat i escape'uje
    // w nim każdy `"`, więc zagnieżdżone cudzysłowy potrafią dojść do PowerShella połamane.
    const { cols, rows } = consoleSize || FALLBACK_CONSOLE_SIZE;
    // Windows 10 (conhost 10.0.19041): w trybie pełnoekranowym Claude Code stara konsola
    // przekazuje xtermowi tylko widoczny ekran — historia zapełnia się powtórzeniami
    // i dziurami, przewijanie nie działa, a długie wklejki gubią początek. Zwykły tryb
    // działa poprawnie. Zmienna ma pierwszeństwo przed ustawieniem `tui` i dotyczy tylko
    // sesji z launchera. Windows 11 (kompilacja 22000+) zostaje z trybem pełnoekranowym.
    const noFullscreen = isWindows10() ? '$env:CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1; ' : '';
    const prelude = `${noFullscreen}$null = & cmd.exe /c mode con: cols=${cols} lines=${rows}; `;
    return {
      ...base,
      executable: 'powershell.exe',
      args: ['-NoExit', '-Command', `${prelude}${command}`],
      useWin32Conhost: true,
    };
  }

  // -i jest tu równie ważne co --login: shell odpalony samym `--login -c` jest
  // nieinteraktywny, więc pomija ~/.zshrc (i pośrednio ~/.bashrc). A to tam instalator
  // Claude Code i nvm dopisują PATH — bez tego sesja wita użytkownika komunikatem
  // „command not found: claude", mimo że w zwykłym terminalu komenda działa.
  const shell = platform === 'darwin' ? '/bin/zsh' : '/bin/bash';
  const reenter = platform === 'darwin' ? 'exec zsh' : 'exec bash';
  return {
    ...base,
    executable: shell,
    args: ['--login', '-i', '-c', `CLAUDE_CODE_NO_FLICKER=1 ${command}; ${reenter}`],
  };
}

// Mierzy, ile znaków naszej czcionki mieści się w prostokącie o zadanych pikselach.
// Używane tylko do rozmiaru startowego konsoli — właściwy rozmiar bierzemy potem
// wprost z xterma, który liczy to dokładniej.
function measureCell() {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.font = `${TERMINAL_OPTIONS.fontSize}px ${TERMINAL_OPTIONS.fontFamily}`;
    const width = ctx.measureText('M'.repeat(50)).width / 50;
    if (!isFinite(width) || width <= 0) return null;
    return { width, height: TERMINAL_OPTIONS.fontSize * TERMINAL_OPTIONS.lineHeight };
  } catch (error) {
    return null;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Terminal otwiera się w splicie obok tego, co już jest w workspace, więc na starcie
// dostaje mniej więcej połowę szerokości. To zgadywanie, ale rozstrzyga tylko o tym,
// jak wygląda pierwsza sekunda sesji.
function estimateConsoleSize(app) {
  const cell = measureCell();
  const container = app && app.workspace ? app.workspace.containerEl : null;
  if (!cell || !container || !container.clientWidth || !container.clientHeight) {
    return { ...FALLBACK_CONSOLE_SIZE };
  }
  const { minCols, maxCols, minRows, maxRows } = CONSOLE_SIZE_LIMITS;
  return {
    cols: clamp(Math.floor((container.clientWidth * 0.5) / cell.width), minCols, maxCols),
    rows: clamp(Math.floor((container.clientHeight * 0.85) / cell.height), minRows, maxRows),
  };
}

// emulator.resize() Terminala dopasowuje xterm, a potem próbuje przeskalować konsolę
// własnym resizerem Pythona. Ten jest u nas celowo wyłączony (pusty pythonExecutable),
// więc drugi krok zawsze kończy się „Terminal resizer disabled”. xterm jest wtedy już
// dopasowany, a konsolę skaluje nasz resizer — ten błąd tylko zaśmiecał logi.
function warnUnlessResizerDisabled(context, error) {
  const message = error && error.message ? error.message : String(error);
  if (/resizer disabled/i.test(message)) return;
  console.warn(`[claude-launcher] ${context}`, error);
}

// Trzyma konsolę Windows w tym samym rozmiarze co xterm. Jeden resizer na sesję;
// gdy sesja się kończy albo widok znika, proces PowerShella idzie za nią.
class ConsoleResizer {
  constructor(emulator) {
    this.emulator = emulator;
    this.process = null;
    this.disposed = false;
    this.lastSent = '';
    this.subscription = null;
    this.timers = [];
    this.dpiCleanup = null;
    this.pendingTimer = null;
    this.startupCleanup = null;
  }

  async start() {
    const { terminal } = this.emulator;
    const shellPid = await this.resolveShellPid();
    if (this.disposed || !shellPid) return false;

    const { spawn } = require('child_process');
    // -InputFormat/-OutputFormat Text: przy przekierowanym stdin PowerShell domyślnie
    // wchodzi w tryb XML i pisze błędy na stderr jako CLIXML — log traci treść.
    // Stdin i tak czytamy surowym StreamReaderem, więc Text niczego nie psuje.
    this.process = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-InputFormat', 'Text', '-OutputFormat', 'Text', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodePowerShellCommand(RESIZER_PS)],
      { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true }
    );

    this.process.on('error', (error) => {
      console.error('[claude-launcher] resizer konsoli nie wystartował', error);
      this.dispose();
    });
    // Buforujemy do pełnych linii: CLIXML przychodzi jako nagłówek + osobna linia XML,
    // a dekodowanie kawałka w pół dokumentu gubiłoby treść błędu.
    let stderrBuffer = '';
    const logStderr = (line) => {
      const text = decodeResizerStderr(line);
      if (!text) return;
      if (text.startsWith('info: ')) console.log('[claude-launcher] resizer:', text.slice(6));
      else console.error('[claude-launcher] resizer:', text);
    };
    this.process.stderr.on('data', (chunk) => {
      stderrBuffer += chunk.toString();
      let newline;
      while ((newline = stderrBuffer.indexOf('\n')) !== -1) {
        logStderr(stderrBuffer.slice(0, newline));
        stderrBuffer = stderrBuffer.slice(newline + 1);
      }
    });
    this.process.once('exit', () => {
      logStderr(stderrBuffer);
      stderrBuffer = '';
      this.process = null;
    });

    if (!this.write(`${shellPid}`)) return false;

    // Pierwsze dopasowanie od razu, kolejne przy każdej zmianie rozmiaru panelu.
    // Terminal sam resize'uje xterm, więc wystarczy słuchać jego zdarzenia.
    this.prime();
    this.subscription = terminal.onResize(({ cols, rows }) => this.send(cols, rows));
    this.watchDpi();
    this.watchStartupRedraw();
    return true;
  }

  // Zgłoszenie z Windowsa: resizer znajduje konsolę i ustawia rozmiar zgodny z xtermem
  // (log „konsola sesji: PID …”), a mimo to sesja startuje z rozjechanymi ramkami
  // i zjadanymi spacjami przy pisaniu. Prostuje ją dopiero minimalne przeciągnięcie
  // krawędzi panelu, czyli zmiana rozmiaru już PO tym, jak Claude się narysował.
  // Robimy to samo automatycznie: gdy wyjście sesji ucichnie, poruszamy konsolą
  // o jedną kolumnę i wracamy, a Claude przerysowuje się pod właściwy rozmiar.
  // Pierwszy klawisz wciśnięty przez użytkownika kończy pilnowanie — nie chcemy
  // przerysowania w trakcie pisania. Celowo onKey, nie onData: onData odpala też
  // przy automatycznych odpowiedziach xterma na zapytania konsoli (pozycja kursora,
  // atrybuty terminala), które conhost i Claude wysyłają zaraz po starcie — w 1.4.7
  // to one wyłączały pilnowanie, zanim doszło do pierwszego poruszenia.
  watchStartupRedraw() {
    const { terminal } = this.emulator;
    if (!terminal || typeof terminal.onWriteParsed !== 'function') {
      console.log('[claude-launcher] terminal bez onWriteParsed — pomijam przerysowanie po starcie');
      return;
    }
    const startedAt = Date.now();
    let nudges = 0;
    let quietTimer = null;
    let ignoreUntil = 0;
    let writeSub = null;
    let dataSub = null;
    const stop = (reason) => {
      if (reason) console.log(`[claude-launcher] koniec pilnowania startu sesji: ${reason}`);
      if (quietTimer) self.clearTimeout(quietTimer);
      quietTimer = null;
      for (const sub of [writeSub, dataSub]) {
        if (sub && typeof sub.dispose === 'function') {
          try {
            sub.dispose();
          } catch (error) {
            console.warn('[claude-launcher]', error);
          }
        }
      }
      writeSub = null;
      dataSub = null;
      this.startupCleanup = null;
    };
    this.startupCleanup = stop;

    writeSub = terminal.onWriteParsed(() => {
      if (this.disposed) return;
      const now = Date.now();
      if (now - startedAt > STARTUP_WATCH_MS) {
        stop(nudges ? '' : 'minął czas, bez poruszenia');
        return;
      }
      // Przerysowanie po naszym własnym poruszeniu nie jest nowym rysowaniem Claude'a.
      if (now < ignoreUntil) return;
      if (quietTimer) self.clearTimeout(quietTimer);
      quietTimer = self.setTimeout(() => {
        quietTimer = null;
        if (this.disposed) return;
        nudges += 1;
        ignoreUntil = Date.now() + NUDGE_RESTORE_MS + STARTUP_QUIET_MS * 2;
        this.nudge();
        if (nudges >= STARTUP_MAX_NUDGES) stop('');
      }, STARTUP_QUIET_MS);
    });
    if (typeof terminal.onKey === 'function') {
      dataSub = terminal.onKey(() => stop(nudges ? '' : 'użytkownik zaczął pisać przed poruszeniem'));
    }
  }

  // Najpierw dopasowujemy xterm do panelu (jak przy przeciągnięciu krawędzi),
  // potem konsola na chwilę o kolumnę węższa i z powrotem do rozmiaru xterma.
  nudge() {
    const { emulator } = this;
    const fit = emulator && typeof emulator.resize === 'function'
      ? Promise.resolve(emulator.resize()).catch((error) => warnUnlessResizerDisabled('refit przed poruszeniem konsoli', error))
      : Promise.resolve();
    fit.then(() => {
      if (this.disposed) return;
      const { terminal } = this.emulator;
      const { cols, rows } = terminal;
      if (!cols || !rows || cols <= 20) return;
      console.log(`[claude-launcher] poruszam konsolą po starcie sesji (${cols}x${rows})`);
      this.send(cols - 1, rows, true);
      const timer = self.setTimeout(() => {
        if (this.disposed) return;
        const { terminal } = this.emulator;
        this.send(terminal.cols, terminal.rows, true);
      }, NUDGE_RESTORE_MS);
      this.timers.push(timer);
    });
  }

  // Terminal dopasowuje xterm wyłącznie z ResizeObservera na kontenerze panelu.
  // Przeciągnięcie okna Obsidiana na monitor o innej skali zmienia devicePixelRatio,
  // ale niekoniecznie rozmiar CSS kontenera — observer wtedy milczy i terminal
  // zostaje w siatce policzonej dla poprzedniego ekranu. matchMedia na bieżącej
  // rozdzielczości odpala się dokładnie przy takim przejściu; listener jest
  // jednorazowy, więc po każdej zmianie uzbrajamy go od nowa dla nowego dpr.
  watchDpi() {
    const arm = () => {
      if (this.disposed) return;
      let media;
      try {
        media = self.matchMedia(`(resolution: ${self.devicePixelRatio}dppx)`);
      } catch (error) {
        return;
      }
      const onChange = () => {
        media.removeEventListener('change', onChange);
        this.dpiCleanup = null;
        if (this.disposed) return;
        this.refit();
        arm();
      };
      media.addEventListener('change', onChange);
      this.dpiCleanup = () => media.removeEventListener('change', onChange);
    };
    arm();
  }

  // Wymusza przeliczenie siatki xterma pod nowy monitor i od nowa dopasowuje
  // konsolę. prime() wysyła rozmiar z flagą force i ponawia z opóźnieniem —
  // dokładnie to, czego trzeba, gdy refit przyjdzie zanim panel się ustabilizuje.
  refit() {
    const { emulator } = this;
    if (emulator && typeof emulator.resize === 'function') {
      Promise.resolve(emulator.resize())
        .catch((error) => warnUnlessResizerDisabled('refit po zmianie monitora', error));
    }
    this.prime();
  }

  // Konsola pod conhostem powstaje z opóźnieniem — PowerShell musi najpierw wstać.
  // Gdyby pierwsza próba trafiła w pustkę, a użytkownik nigdy nie ruszył okna,
  // sesja zostałaby na rozmiarze z `mode con`. Dlatego ponawiamy przez kilka sekund.
  prime() {
    const { terminal } = this.emulator;
    this.send(terminal.cols, terminal.rows, true);
    for (const delay of [400, 1200, 3000]) {
      const timer = self.setTimeout(() => {
        if (this.disposed) return;
        const { terminal } = this.emulator;
        this.send(terminal.cols, terminal.rows, true);
      }, delay);
      this.timers.push(timer);
    }
  }

  async resolveShellPid() {
    try {
      const pty = await this.emulator.pseudoterminal;
      const shell = pty ? await pty.shell : null;
      return shell && shell.pid ? shell.pid : null;
    } catch (error) {
      console.error('[claude-launcher] nie udało się ustalić PID-u konsoli', error);
      return null;
    }
  }

  // Przeciąganie panelu sypie rozmiarami kilka razy na sekundę. Każda zmiana rozmiaru
  // konsoli to przełamanie jej tekstu i przerysowanie przez Claude'a, więc zwykłe
  // zdarzenia zbieramy i wysyłamy tylko ostatni rozmiar, gdy ruch ustanie.
  // force (prime, refit) idzie od razu.
  send(cols, rows, force) {
    if (!cols || !rows) return;
    if (this.pendingTimer) {
      self.clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    if (force) {
      this.flush(cols, rows, true);
      return;
    }
    this.pendingTimer = self.setTimeout(() => {
      this.pendingTimer = null;
      if (!this.disposed) this.flush(cols, rows, false);
    }, RESIZE_SETTLE_MS);
  }

  flush(cols, rows, force) {
    const payload = `${cols}x${rows}`;
    if (!force && payload === this.lastSent) return;
    if (this.write(payload)) this.lastSent = payload;
  }

  write(line) {
    if (this.disposed || !this.process || !this.process.stdin || this.process.stdin.destroyed) {
      return false;
    }
    try {
      this.process.stdin.write(`${line}\n`);
      return true;
    } catch (error) {
      console.error('[claude-launcher] nie udało się wysłać rozmiaru do resizera', error);
      return false;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.startupCleanup) this.startupCleanup();
    for (const timer of this.timers) self.clearTimeout(timer);
    this.timers = [];
    if (this.pendingTimer) self.clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    if (this.dpiCleanup) {
      try {
        this.dpiCleanup();
      } catch (error) {
        console.warn('[claude-launcher]', error);
      }
      this.dpiCleanup = null;
    }
    if (this.subscription && typeof this.subscription.dispose === 'function') {
      try {
        this.subscription.dispose();
      } catch (error) {
        console.warn('[claude-launcher]', error);
      }
    }
    this.subscription = null;
    if (this.process) {
      try {
        this.process.kill();
      } catch (error) {
        console.warn('[claude-launcher]', error);
      }
      this.process = null;
    }
  }
}

module.exports = class ClaudeLauncher extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.resizers = new Set();
    // Emulatory, którymi już się zajęliśmy — także te, których sesja się skończyła.
    // WeakSet, bo emulator znika razem z widokiem i nie chcemy go trzymać w pamięci.
    this.handledEmulators = new WeakSet();
    this.register(() => {
      for (const resizer of this.resizers) resizer.dispose();
      this.resizers.clear();
    });

    // Plugin Terminal stawia nową sesję przy każdym przywróceniu karty (restart
    // Obsidiana, ponowne otwarcie workspace). Taka sesja startuje z naszego profilu,
    // ale bez kliknięcia ikonki — resizer podpięty tylko w launch() by jej nie objął
    // i konsola zostałaby w rozmiarze startowym. Dlatego pilnujemy wszystkich kart.
    if (currentPlatform() === 'win32') {
      this.app.workspace.onLayoutReady(() => this.syncResizers());
      this.registerEvent(this.app.workspace.on('layout-change', () => this.syncResizers()));
      this.registerInterval(self.setInterval(() => this.syncResizers(), RESIZER_SCAN_MS));
    }

    // Claude Code z FORCE_HYPERLINK=1 wysyła adresy WWW jako linki OSC 8. Terminal nie podaje
    // xtermowi własnej obsługi takich linków, więc xterm pokazuje okienko „Do you want to
    // navigate…”, a jego window.open() Obsidian blokuje — klik nic nie robi. Podpinamy obsługę,
    // która otwiera http(s) w domyślnej przeglądarce. Innych protokołów nie bierzemy: linki
    // file:// do notatek ma przechodzić dalej do Claude Code, który otwiera je w Obsidianie.
    this.app.workspace.onLayoutReady(() => this.syncLinkHandlers());
    this.registerEvent(this.app.workspace.on('layout-change', () => this.syncLinkHandlers()));
    this.registerInterval(self.setInterval(() => this.syncLinkHandlers(), RESIZER_SCAN_MS));

    addIcon('claude-mascot', MASCOT);

    this.addRibbonIcon('claude-mascot', 'Claude Code — nowa sesja', () => {
      this.launch();
    });

    this.addCommand({
      id: 'open-claude-code',
      name: 'Otwórz nową sesję Claude Code',
      callback: () => {
        this.launch();
      },
    });

    this.addSettingTab(new ClaudeLauncherSettingTab(this.app, this));

    // obsidian://claude-launcher?attach=<id> otwiera sesję w tle (claude attach) w karcie
    // terminala. Korzysta z tego np. zewnętrzny panel sesji. Kolejne prośby podmieniają
    // sesję w tej samej karcie (patrz attach).
    this.mainLeaf = null;
    // Główna karta = ostatnia aktywna karta terminala (ta, w której pracujesz).
    this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
      if (leaf && leaf.view && leaf.view.emulator) this.mainLeaf = leaf;
    }));
    this.registerObsidianProtocolHandler('claude-launcher', (params) => {
      const id = String(params.attach || '');
      if (/^[a-z0-9-]{4,64}$/i.test(id)) this.attach(id);
    });

    // Capture, żeby wyprzedzić handler klawiszy xterma, który zamienia Ctrl+V
    // na znak sterujący 0x16 zamiast wkleić schowek.
    if (currentPlatform() !== 'darwin') {
      this.registerDomEvent(document, 'keydown', (event) => this.handleClipboardKey(event), {
        capture: true,
      });
    }
  }

  // Znajduje instancję xterma w widoku, w którym siedzi zdarzenie. Chodzimy po
  // liściach zamiast po typie widoku, bo plugin Terminal nadaje mu nazwę zależną
  // od własnego kontekstu.
  terminalFromEvent(event) {
    const target = event.target;
    if (!(target instanceof Node)) return null;
    let found = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (found) return;
      const view = leaf.view;
      const terminal = view && view.emulator ? view.emulator.terminal : null;
      if (!terminal || !view.containerEl || !view.containerEl.contains(target)) return;
      found = terminal;
    });
    return found;
  }

  // Rozpoznajemy klawisz po trzech polach naraz, nie po samym `code`. Narzędzia do
  // dyktowania wklejają tekst symulowanym Ctrl+V (SendInput) z samym kodem wirtualnym,
  // bez kodu skanowania — Chromium daje wtedy pusty `code`, a `key` i `keyCode` są
  // poprawne. Na samym `code` takie wklejenie przelatywało do xterma jako znak 0x16.
  // Ctrl+Shift+V i Shift+Insert to wklejanie w innych terminalach, część narzędzi ich używa.
  handleClipboardKey(event) {
    if (event.altKey || event.metaKey) return;

    const is = (code, char, keyCode) =>
      event.code === code || (event.key && event.key.toLowerCase() === char) || event.keyCode === keyCode;
    const paste =
      (event.ctrlKey && is('KeyV', 'v', 86)) ||
      (event.shiftKey && !event.ctrlKey && is('Insert', 'insert', 45));
    const copy = event.ctrlKey && !event.shiftKey && is('KeyC', 'c', 67);
    if (!paste && !copy) return;

    const terminal = this.terminalFromEvent(event);
    if (!terminal) return;

    if (paste) {
      event.preventDefault();
      event.stopPropagation();
      this.pasteInto(terminal);
      return;
    }

    // Ctrl+C bez zaznaczenia musi zostać przerwaniem procesu, inaczej nie da się
    // ubić tego, co akurat chodzi w terminalu.
    if (!terminal.hasSelection()) return;
    event.preventDefault();
    event.stopPropagation();
    this.copyFrom(terminal);
  }

  // Schowek czytamy synchronicznie, jeszcze w obsłudze klawisza. Narzędzia do dyktowania
  // podkładają tekst do schowka, wysyłają Ctrl+V i zaraz przywracają poprzednią
  // zawartość — asynchroniczne navigator.clipboard potrafi zdążyć dopiero po przywróceniu
  // i wkleić stary schowek. Edytor tekstu czyta schowek od razu, dlatego tam działało.
  readClipboardNow() {
    try {
      const { clipboard } = require('electron');
      if (clipboard && typeof clipboard.readText === 'function') return clipboard.readText();
    } catch (error) {
      return null;
    }
    return null;
  }

  async pasteInto(terminal) {
    try {
      const now = this.readClipboardNow();
      const text = now !== null ? now : await navigator.clipboard.readText();
      if (!text) return;
      terminal.paste(text);
    } catch (error) {
      console.error('[claude-launcher] nie udało się wkleić ze schowka', error);
    }
  }

  async copyFrom(terminal) {
    try {
      await navigator.clipboard.writeText(terminal.getSelection());
      terminal.clearSelection();
    } catch (error) {
      console.error('[claude-launcher] nie udało się skopiować zaznaczenia', error);
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  terminalPlugin() {
    const plugins = this.app.plugins;
    return plugins && plugins.plugins ? plugins.plugins[TERMINAL_PLUGIN_ID] : null;
  }

  // Na Unixach Terminal bez Pythona w ogóle nie postawi pseudoterminala, więc podajemy
  // go na sztywno. Na Windowsie zostawiamy pole puste — skalowaniem konsoli zajmuje się
  // nasz resizer w PowerShellu, a przy pustym polu Terminal spawnuje shell z ukrytym
  // oknem, więc obok Obsidiana nie mruga czarne okno konsoli.
  resolvePython() {
    return currentPlatform() === 'win32' ? '' : 'python3';
  }

  // Terminal do 3.23 rejestruje domyślny profil jako jedną komendę bez sufiksu katalogu
  // (`open-terminal.default`), a dopiero nowsze wersje rozbijają go na `.root` i `.current`.
  // Bez tego fallbacku launcher na starszym Terminalu twierdzi, że komend w ogóle nie ma.
  resolveCommandId() {
    const candidates = [
      `terminal:open-terminal.default.${this.settings.cwd}`,
      'terminal:open-terminal.default',
    ];
    return candidates.find((id) => this.app.commands.commands[id]);
  }

  // Podmienia domyślny profil Terminala na własny TYLKO na czas odpalenia sesji,
  // a potem przywraca poprzedni. Terminal odczytuje profil synchronicznie przy
  // wykonaniu komendy, więc przywrócenie zaraz po niej jest bezpieczne.
  // Jedna karta „główna”: ostatnio aktywna karta terminala (albo nowa, gdy żadnej nie ma). Kolejne linki podmieniają w niej
  // sesję zamiast stawiać nowe karty: Ctrl+Z wychodzi z `claude attach` do shella (sesja
  // w tle pracuje dalej), potem wpisujemy `claude attach <id>`. Profil kończy się na
  // `exec zsh`, więc po wyjściu z attach w karcie zawsze czeka shell.
  async attach(id) {
    const main = this.mainLeaf;
    const term = main && main.view && main.view.emulator && main.view.containerEl.isConnected ? main.view.emulator.terminal : null;
    if (term && typeof term.input === 'function') {
      this.app.workspace.revealLeaf(main);
      this.app.workspace.setActiveLeaf(main, { focus: true });
      term.input('\x1a', true);
      await new Promise((resolve) => self.setTimeout(resolve, 1200));
      // `claude attach` po Ctrl+Z kończy się sam, ale `claude agents` zostaje zawieszony —
      // taki podgląd zamykamy (sesje w tle chodzą w demonie, nic nie tracą). Spacja na
      // początku: linia nie trafia do historii shella.
      const claude = this.settings.command.trim() || 'claude';
      term.input(` [[ "$(jobs %+ 2>/dev/null)" == *"${claude} a"* ]] && kill -9 %+ 2>/dev/null; clear; ${claude} attach ${id}\r`, true);
      return;
    }
    const before = this.collectEmulators();
    await this.launch(id);
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      let leaf = null;
      this.app.workspace.iterateAllLeaves((l) => {
        if (!leaf && l.view && l.view.emulator && !before.has(l.view.emulator)) leaf = l;
      });
      if (leaf) { this.mainLeaf = leaf; return; }
      await new Promise((resolve) => self.setTimeout(resolve, 150));
    }
  }

  async launch(attachId) {
    const terminal = this.terminalPlugin();
    if (!terminal) {
      new Notice('Zainstaluj i włącz plugin Terminal — Claude Code Launcher go potrzebuje.', 8000);
      return;
    }

    const commandId = this.resolveCommandId();
    if (!commandId) {
      new Notice('Plugin Terminal nie udostępnia komend. Włącz w nim „Add to command".', 8000);
      return;
    }

    const before = this.collectEmulators();
    const previous = await this.installProfile(terminal, true, attachId);
    this.app.commands.executeCommandById(commandId);
    await this.restoreDefaultProfile(terminal, previous);
    // profil wraca do zwykłej nowej sesji, żeby ikonka nie podłączała się do starej
    if (attachId) await this.installProfile(terminal, false);
    if (currentPlatform() === 'win32') this.waitForNewTerminal(before);
  }

  // Widok terminala powstaje asynchronicznie. Skan co RESIZER_SCAN_MS i tak go złapie,
  // ale po kliknięciu ikonki chcemy dopasować konsolę od razu, więc przez chwilę
  // skanujemy gęściej. Karta, która pojawiła się po kliknięciu, jest nasza z definicji,
  // więc przyjmujemy ją nawet wtedy, gdy nie da się odczytać jej profilu.
  async waitForNewTerminal(before) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (this.syncResizers(before) > 0) return;
      await new Promise((resolve) => self.setTimeout(resolve, 150));
    }
    console.warn('[claude-launcher] nie znalazłem widoku terminala — konsola bez resizera');
  }

  collectEmulators() {
    const emulators = new Set();
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (view && view.emulator) emulators.add(view.emulator);
    });
    return emulators;
  }

  syncLinkHandlers() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      const terminal = view && view.emulator ? view.emulator.terminal : null;
      if (!terminal || !terminal.options || terminal.options.linkHandler === LINK_HANDLER) return;
      try {
        terminal.options.linkHandler = LINK_HANDLER;
      } catch (error) {
        console.error('[claude-launcher] nie udało się podpiąć obsługi linków', error);
      }
    });
  }

  // Stan widoku Terminala: najpierw pole `state`, a gdy go nie ma (inna wersja
  // Terminala), szukamy obiektu z profilem w tym, co zwraca getState().
  terminalState(view) {
    if (view.state && view.state.profile) return view.state;
    try {
      const raw = typeof view.getState === 'function' ? view.getState() : null;
      if (raw && typeof raw === 'object') {
        for (const value of Object.values(raw)) {
          if (value && typeof value === 'object' && value.profile) return value;
        }
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  // Nasz resizer jest potrzebny tylko tam, gdzie nikt inny nie skaluje konsoli:
  // profil launchera, conhost włączony, a resizer Pythona z Terminala wyłączony.
  isLauncherTerminal(view) {
    const state = this.terminalState(view);
    const profile = state ? state.profile : null;
    if (!profile || profile.type !== 'integrated') return false;
    const ours = state.profileSourceId === PROFILE_ID || profile.name === PROFILE_NAME;
    return ours && profile.useWin32Conhost === true && !profile.pythonExecutable;
  }

  // Podpina resizer do każdej karty launchera, która go jeszcze nie ma. Zwraca,
  // ile nowych podpiął. Emulator trafia do handledEmulators od razu, synchronicznie,
  // więc równoległe wywołania nie podepną drugiego resizera do tej samej sesji.
  syncResizers(before) {
    let attached = 0;
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      const emulator = view ? view.emulator : null;
      if (!emulator || !emulator.terminal || !emulator.pseudoterminal) return;
      if (this.handledEmulators.has(emulator)) return;
      const launchedNow = before ? !before.has(emulator) : false;
      if (!launchedNow && !this.isLauncherTerminal(view)) return;
      this.handledEmulators.add(emulator);
      this.attachResizer(emulator);
      attached++;
    });
    return attached;
  }

  async attachResizer(emulator) {
    const resizer = new ConsoleResizer(emulator);
    this.resizers.add(resizer);
    const forget = () => {
      resizer.dispose();
      this.resizers.delete(resizer);
    };
    try {
      const started = await resizer.start();
      if (!started) {
        forget();
        return;
      }
      emulator.pseudoterminal
        .then(async (pty) => pty.onExit)
        .catch(() => undefined)
        .finally(forget);
    } catch (error) {
      console.error('[claude-launcher] resizer konsoli padł przy starcie', error);
      forget();
    }
  }

  // Zapisuje profil w ustawieniach Terminala. Gdy makeDefault=true, zwraca poprzedni
  // defaultProfile do przywrócenia (albo undefined, gdy nie ma czego przywracać).
  async installProfile(terminal, makeDefault, attachId) {
    const settings = terminal.settings;
    if (!settings || typeof settings.mutate !== 'function') {
      new Notice('Nieznana wersja pluginu Terminal — ustaw profil „Claude Code" ręcznie.', 8000);
      return undefined;
    }

    const previous = settings.value.defaultProfile;
    const profile = buildProfile({ ...this.settings, attach: attachId }, this.resolvePython(), estimateConsoleSize(this.app));

    try {
      await settings.mutate((draft) => {
        draft.profiles[PROFILE_ID] = profile;
        if (makeDefault) draft.defaultProfile = PROFILE_ID;
      });
    } catch (error) {
      console.error('[claude-launcher] nie udało się zapisać profilu w Terminalu', error);
      new Notice('Nie udało się zapisać profilu w Terminalu — sprawdź konsolę.', 8000);
      return undefined;
    }

    this.warnAboutForeignResizer(settings);
    if (!makeDefault) await this.writeSettings(settings);
    return previous === PROFILE_ID ? undefined : previous;
  }

  // Terminal waliduje zapisywany profil i każde pole spoza typu `string` zastępuje swoim
  // domyślnym — dla `pythonExecutable` jest nim `python3`. Dlatego na Windowsie podajemy
  // pusty string, a nie pomijamy pole: pominięte wróciłoby jako `python3` i Terminal
  // odpaliłby własny resizer, który bez pakietów `psutil` i `pywinctl` kończy się kodem 1
  // („Terminal resizer exited unexpectedly") i zostawia konsolę bez skalowania.
  warnAboutForeignResizer(settings) {
    if (currentPlatform() !== 'win32') return;
    const saved = settings.value.profiles[PROFILE_ID];
    if (saved && saved.pythonExecutable) {
      console.warn(
        `[claude-launcher] Terminal nadpisał pythonExecutable na "${saved.pythonExecutable}" — ` +
          'jego resizer wystartuje i bez pakietów psutil/pywinctl padnie z kodem 1',
      );
    }
  }

  async restoreDefaultProfile(terminal, previous) {
    const settings = terminal.settings;
    if (!settings || typeof settings.mutate !== 'function') return;

    if (previous !== undefined) {
      try {
        await settings.mutate((draft) => {
          draft.defaultProfile = previous;
        });
      } catch (error) {
        console.error('[claude-launcher] nie udało się przywrócić domyślnego profilu', error);
      }
    }
    await this.writeSettings(settings);
  }

  async writeSettings(settings) {
    if (typeof settings.write !== 'function') return;
    try {
      await settings.write();
    } catch (error) {
      console.error('[claude-launcher] nie udało się zapisać ustawień Terminala', error);
    }
  }
};

class ClaudeLauncherSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    const preview = new Setting(containerEl).setName('Po kliknięciu ikonki uruchomi się');
    const previewValue = preview.descEl.createEl('code');
    const refreshPreview = () => {
      previewValue.setText(fullCommand(this.plugin.settings));
    };
    refreshPreview();

    new Setting(containerEl)
      .setName('Polecenie')
      .setDesc('Co ma się odpalić w terminalu. Domyślnie: claude')
      .addText((text) =>
        text
          .setPlaceholder('claude')
          .setValue(this.plugin.settings.command)
          .onChange(async (value) => {
            this.plugin.settings.command = value;
            refreshPreview();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Tryb bypass permissions')
      .setDesc(
        'Dokłada flagę --dangerously-skip-permissions, czyli to samo, co tryb bypass permissions ' +
          'w Claude Code. Claude przestaje pytać o zgodę przed każdą zmianą pliku i każdą komendą. ' +
          'Wyłącz, jeśli wolisz startować ze zwykłymi pytaniami o uprawnienia.'
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.skipPermissions).onChange(async (value) => {
          this.plugin.settings.skipPermissions = value;
          refreshPreview();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Katalog startowy')
      .setDesc('Gdzie ma wystartować sesja.')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('root', 'Katalog vaulta')
          .addOption('current', 'Folder aktywnej notatki')
          .setValue(this.plugin.settings.cwd)
          .onChange(async (value) => {
            this.plugin.settings.cwd = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Profil w pluginie Terminal')
      .setDesc(
        'Profil „Claude Code" tworzy się sam przy pierwszym kliknięciu ikonki. Użyj tego przycisku, ' +
          'jeśli zmieniłeś ustawienia powyżej i chcesz je od razu przepisać do Terminala.'
      )
      .addButton((button) =>
        button.setButtonText('Utwórz / odśwież').onClick(async () => {
          const terminal = this.plugin.terminalPlugin();
          if (!terminal) {
            new Notice('Plugin Terminal nie jest włączony.', 8000);
            return;
          }
          await this.plugin.installProfile(terminal, false);
          new Notice('Profil „Claude Code" zapisany w pluginie Terminal.');
        })
      );
  }
}
