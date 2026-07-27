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

const WINDOWS_PYTHON_CANDIDATES = ['py', 'python', 'python3'];

// Na Windowsie resizer Terminala robi dwie rzeczy naraz: chowa okno conhosta
// (`window.hide(True)`) i skaluje konsolę do rozmiaru panelu. Napędza go Python
// z psutil + pywinctl. Szukamy interpretera, który ma jedno i drugie — bez tego
// Terminal startuje z windowsHide i okno też nie będzie widoczne, ale konsola
// zostanie na sztywnym rozmiarze i tekst zacznie się łamać.
async function detectWindowsPython() {
  const { execFile } = require('child_process');
  for (const executable of WINDOWS_PYTHON_CANDIDATES) {
    const usable = await new Promise((resolve) => {
      try {
        execFile(
          executable,
          ['-c', 'import psutil, pywinctl'],
          { windowsHide: true, timeout: 15000 },
          (error) => resolve(!error)
        );
      } catch (error) {
        resolve(false);
      }
    });
    if (usable) return executable;
  }
  return '';
}

// Kształt profilu 1:1 z tym, co plugin Terminal zapisuje w swoim data.json.
// Po wyjściu z Claude'a zostajemy w shellu (exec zsh / -NoExit), żeby terminal nie znikał.
function buildProfile(settings, pythonExecutable) {
  const platform = currentPlatform();
  const command = fullCommand(settings);
  const base = {
    environment: [],
    followTheme: true,
    name: PROFILE_NAME,
    platforms: { [platform]: true },
    pythonExecutable,
    restoreHistory: false,
    rightClickAction: 'copyPaste',
    successExitCodes: ['0', 'SIGINT', 'SIGTERM'],
    terminalOptions: { documentOverride: null },
    type: 'integrated',
    useWin32Conhost: true,
  };

  // useWin32Conhost to na Windowsie jedyne źródło prawdziwej konsoli — Terminal zawsze
  // spawnuje ze `stdio: pipe`, więc bez conhosta proces nie ma TTY i Claude przechodzi
  // w tryb --print („Input must be provided either through stdin…").
  if (platform === 'win32') {
    return {
      ...base,
      executable: 'powershell.exe',
      args: ['-NoExit', '-Command', command],
      useWin32Conhost: true,
    };
  }

  const shell = platform === 'darwin' ? '/bin/zsh' : '/bin/bash';
  const reenter = platform === 'darwin' ? 'exec zsh' : 'exec bash';
  return {
    ...base,
    executable: shell,
    args: ['--login', '-c', `CLAUDE_CODE_NO_FLICKER=1 ${command}; ${reenter}`],
  };
}

module.exports = class ClaudeLauncher extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.pythonExecutable = undefined;
    this.warnedAboutPython = false;

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
  // go na sztywno. Na Windowsie jest opcjonalny — wykrywamy raz na sesję, bo sprawdzenie
  // kosztuje kilka uruchomień interpretera.
  async resolvePython() {
    if (currentPlatform() !== 'win32') return 'python3';
    if (this.pythonExecutable === undefined) {
      this.pythonExecutable = await detectWindowsPython();
    }
    if (!this.pythonExecutable && !this.warnedAboutPython) {
      this.warnedAboutPython = true;
      new Notice(
        'Claude Code Launcher: terminal nie będzie dopasowywał się do szerokości panelu. ' +
          'Żeby to naprawić, zainstaluj Pythona i wykonaj: pip install psutil pywinctl',
        12000
      );
    }
    return this.pythonExecutable;
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

    const previous = await this.installProfile(terminal, true);
    this.app.commands.executeCommandById(commandId);
    await this.restoreDefaultProfile(terminal, previous);
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
    const profile = buildProfile(this.settings, await this.resolvePython());

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
          // Wymuszamy ponowne szukanie Pythona — ktoś mógł go doinstalować
          // właśnie po to, żeby kliknąć ten przycisk.
          this.plugin.pythonExecutable = undefined;
          this.plugin.warnedAboutPython = false;
          await this.plugin.installProfile(terminal, false);
          new Notice('Profil „Claude Code" zapisany w pluginie Terminal.');
        })
      );
  }
}
