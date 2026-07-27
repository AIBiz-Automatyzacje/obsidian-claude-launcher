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

// Kształt profilu 1:1 z tym, co plugin Terminal zapisuje w swoim data.json.
// Po wyjściu z Claude'a zostajemy w shellu (exec zsh / -NoExit), żeby terminal nie znikał.
function buildProfile(settings) {
  const platform = currentPlatform();
  const command = fullCommand(settings);
  const base = {
    environment: [],
    followTheme: true,
    name: PROFILE_NAME,
    platforms: { [platform]: true },
    pythonExecutable: 'python3',
    restoreHistory: false,
    rightClickAction: 'copyPaste',
    successExitCodes: ['0', 'SIGINT', 'SIGTERM'],
    terminalOptions: { documentOverride: null },
    type: 'integrated',
    useWin32Conhost: true,
  };

  // Windows, dwie flagi, które muszą chodzić w parze:
  //
  // useWin32Conhost — jedyne źródło prawdziwej konsoli. Terminal zawsze spawnuje ze
  //   `stdio: pipe`, więc bez conhosta proces nie ma TTY i Claude przechodzi w tryb
  //   --print („Input must be provided either through stdin…"). Musi zostać włączone.
  //
  // pythonExecutable — na Windowsie Python napędza wyłącznie resizer konsoli i jest
  //   opcjonalny. Terminal spawnuje z `windowsHide: !resizer`, więc dopóki resizer żyje,
  //   okno conhosta JEST WIDOCZNE obok panelu Obsidiana. Pusty string ubija resizera,
  //   dzięki czemu okno chowa się, a sesja zostaje tylko w Obsidianie.
  //   Koszt: konsola nie skaluje się do rozmiaru panelu.
  if (platform === 'win32') {
    return {
      ...base,
      executable: 'powershell.exe',
      args: ['-NoExit', '-Command', command],
      pythonExecutable: '',
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
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  terminalPlugin() {
    const plugins = this.app.plugins;
    return plugins && plugins.plugins ? plugins.plugins[TERMINAL_PLUGIN_ID] : null;
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
    const profile = buildProfile(this.settings);

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

    new Setting(containerEl)
      .setName('Polecenie')
      .setDesc('Co ma się odpalić w terminalu. Domyślnie: claude')
      .addText((text) =>
        text
          .setPlaceholder('claude')
          .setValue(this.plugin.settings.command)
          .onChange(async (value) => {
            this.plugin.settings.command = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Pomiń pytania o uprawnienia')
      .setDesc(
        'Dokłada --dangerously-skip-permissions. Claude przestaje pytać o zgodę przed każdą operacją ' +
          'na plikach i komendach. Włączaj tylko na własnym komputerze i w vaultcie, któremu ufasz.'
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.skipPermissions).onChange(async (value) => {
          this.plugin.settings.skipPermissions = value;
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
