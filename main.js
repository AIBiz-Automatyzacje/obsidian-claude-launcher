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

function fullCommand(settings) {
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
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ClResizer {
  [StructLayout(LayoutKind.Sequential)] public struct COORD { public short X; public short Y; }
  [StructLayout(LayoutKind.Sequential)] public struct SMALL_RECT { public short Left, Top, Right, Bottom; }
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AttachConsole(uint pid);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool FreeConsole();
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetConsoleScreenBufferSize(IntPtr h, COORD size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetConsoleWindowInfo(IntPtr h, bool absolute, ref SMALL_RECT r);
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Auto)]
  static extern IntPtr CreateFile(string name, uint access, uint share, IntPtr sec, uint disp, uint flags, IntPtr tmpl);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool CloseHandle(IntPtr h);

  // Std handles procesu wskazują na pipe'y od spawna, nie na konsolę, do której
  // się właśnie podłączyliśmy. Uchwyt konsoli bierzemy więc przez CONOUT$.
  public static bool Resize(uint pid, short cols, short rows) {
    FreeConsole();
    if (!AttachConsole(pid)) return false;
    IntPtr h = IntPtr.Zero;
    try {
      h = CreateFile("CONOUT$", 0xC0000000, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
      if (h == IntPtr.Zero || h == new IntPtr(-1)) return false;
      // Bufor nie może być mniejszy od okna, więc najpierw ściągamy okno do
      // minimum, potem ustawiamy bufor, a na końcu rozciągamy okno na docelowy rozmiar.
      SMALL_RECT tiny = new SMALL_RECT();
      tiny.Left = 0; tiny.Top = 0; tiny.Right = 0; tiny.Bottom = 0;
      SetConsoleWindowInfo(h, true, ref tiny);
      COORD size; size.X = cols; size.Y = rows;
      if (!SetConsoleScreenBufferSize(h, size)) return false;
      SMALL_RECT win = new SMALL_RECT();
      win.Left = 0; win.Top = 0; win.Right = (short)(cols - 1); win.Bottom = (short)(rows - 1);
      return SetConsoleWindowInfo(h, true, ref win);
    } catch { return false; }
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

  $done = $false
  if ($target -ne 0) {
    $done = [ClResizer]::Resize([uint32] $target, [short] $cols, [short] $rows)
  }
  if (-not $done) {
    foreach ($candidate in (Get-Candidates $rootPid)) {
      if ([ClResizer]::Resize([uint32] $candidate, [short] $cols, [short] $rows)) {
        $target = $candidate
        $done = $true
        break
      }
    }
  }
}
`;

// PowerShell dostaje skrypt jako -EncodedCommand, żeby stdin został wolny na
// nasze komendy resize (przy -Command - skrypt zjadłby cały strumień wejściowy).
function encodePowerShellCommand(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
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
    const prelude = `$null = & cmd.exe /c mode con: cols=${cols} lines=${rows}; `;
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
  }

  async start() {
    const { terminal } = this.emulator;
    const shellPid = await this.resolveShellPid();
    if (this.disposed || !shellPid) return false;

    const { spawn } = require('child_process');
    this.process = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodePowerShellCommand(RESIZER_PS)],
      { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true }
    );

    this.process.on('error', (error) => {
      console.error('[claude-launcher] resizer konsoli nie wystartował', error);
      this.dispose();
    });
    this.process.stderr.on('data', (chunk) => {
      console.error('[claude-launcher] resizer:', chunk.toString());
    });
    this.process.once('exit', () => {
      this.process = null;
    });

    if (!this.write(`${shellPid}`)) return false;

    // Pierwsze dopasowanie od razu, kolejne przy każdej zmianie rozmiaru panelu.
    // Terminal sam resize'uje xterm, więc wystarczy słuchać jego zdarzenia.
    this.prime();
    this.subscription = terminal.onResize(({ cols, rows }) => this.send(cols, rows));
    return true;
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

  send(cols, rows, force) {
    if (!cols || !rows) return;
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
    for (const timer of this.timers) self.clearTimeout(timer);
    this.timers = [];
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
    this.register(() => {
      for (const resizer of this.resizers) resizer.dispose();
      this.resizers.clear();
    });

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

  handleClipboardKey(event) {
    if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;

    const key = event.code === 'KeyV' || event.code === 'KeyC' ? event.code : null;
    if (!key) return;

    const terminal = this.terminalFromEvent(event);
    if (!terminal) return;

    if (key === 'KeyV') {
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

  async pasteInto(terminal) {
    try {
      const text = await navigator.clipboard.readText();
      if (text) terminal.paste(text);
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

  // Podmienia domyślny profil Terminala na własny TYLKO na czas odpalenia sesji,
  // a potem przywraca poprzedni. Terminal odczytuje profil synchronicznie przy
  // wykonaniu komendy, więc przywrócenie zaraz po niej jest bezpieczne.
  async launch() {
    const terminal = this.terminalPlugin();
    if (!terminal) {
      new Notice('Zainstaluj i włącz plugin Terminal — Claude Code Launcher go potrzebuje.', 8000);
      return;
    }

    const commandId = `terminal:open-terminal.default.${this.settings.cwd}`;
    if (!this.app.commands.commands[commandId]) {
      new Notice('Plugin Terminal nie udostępnia komend. Włącz w nim „Add to command palette".', 8000);
      return;
    }

    const before = this.collectEmulators();
    const previous = await this.installProfile(terminal, true);
    this.app.commands.executeCommandById(commandId);
    await this.restoreDefaultProfile(terminal, previous);
    if (currentPlatform() === 'win32') this.attachResizer(before);
  }

  collectEmulators() {
    const emulators = new Set();
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (view && view.emulator) emulators.add(view.emulator);
    });
    return emulators;
  }

  // Widok terminala powstaje asynchronicznie, więc czekamy na niego, zamiast zakładać,
  // że jest gotowy zaraz po wykonaniu komendy.
  async attachResizer(before) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      let fresh = null;
      for (const emulator of this.collectEmulators()) {
        if (!before.has(emulator) && emulator.terminal && emulator.pseudoterminal) {
          fresh = emulator;
          break;
        }
      }
      if (fresh) {
        const resizer = new ConsoleResizer(fresh);
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
          fresh.pseudoterminal
            .then(async (pty) => pty.onExit)
            .catch(() => undefined)
            .finally(forget);
        } catch (error) {
          console.error('[claude-launcher] resizer konsoli padł przy starcie', error);
          forget();
        }
        return;
      }
      await new Promise((resolve) => self.setTimeout(resolve, 150));
    }
    console.warn('[claude-launcher] nie znalazłem widoku terminala — konsola bez resizera');
  }

  // Zapisuje profil w ustawieniach Terminala. Gdy makeDefault=true, zwraca poprzedni
  // defaultProfile do przywrócenia (albo undefined, gdy nie ma czego przywracać).
  async installProfile(terminal, makeDefault) {
    const settings = terminal.settings;
    if (!settings || typeof settings.mutate !== 'function') {
      new Notice('Nieznana wersja pluginu Terminal — ustaw profil „Claude Code" ręcznie.', 8000);
      return undefined;
    }

    const previous = settings.value.defaultProfile;
    const profile = buildProfile(this.settings, this.resolvePython(), estimateConsoleSize(this.app));

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

    if (!makeDefault) await this.writeSettings(settings);
    return previous === PROFILE_ID ? undefined : previous;
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
