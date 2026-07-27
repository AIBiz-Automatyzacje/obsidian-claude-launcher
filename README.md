# Claude Code Launcher

Ikonka w lewym pasku Obsidiana, która odpala nową sesję **Claude Code** w terminalu wewnątrz vaulta. Jedno kliknięcie zamiast przełączania się do Terminala i wklepywania `cd`.

## Co robi

- Dokłada przycisk z maskotką Claude Code do lewego paska.
- Startuje sesję w katalogu vaulta (albo w folderze aktywnej notatki — do wyboru).
- Po wyjściu z Claude'a zostawia otwarty shell, więc terminal nie znika.
- Sam tworzy sobie profil w pluginie Terminal — nic nie konfigurujesz ręcznie.

Dostępne też z palety komend: **Otwórz nową sesję Claude Code**.

## Wymagania

1. **Obsidian na komputerze** (desktop) — plugin nie działa na telefonie.
2. **Plugin [Terminal](https://github.com/polyipseity/obsidian-terminal)** (polyipseity) — zainstalowany i włączony. To on rysuje terminal, Launcher tylko go odpala.
3. **Claude Code** zainstalowany i dostępny w `PATH` (sprawdź: `which claude` w terminalu).

## Instalacja

### Ręcznie (zip z Releases)

1. Pobierz `claude-launcher.zip` z [ostatniego release'u](../../releases/latest).
2. Rozpakuj do `<twój-vault>/.obsidian/plugins/` — ma powstać folder `claude-launcher` z plikami `main.js` i `manifest.json`.
3. Obsidian → Ustawienia → Dodatki (Community plugins) → odśwież listę → włącz **Claude Code Launcher**.

> Folder `.obsidian` jest ukryty. Na macOS pokażesz go w Finderze skrótem `Cmd + Shift + .`

### Przez BRAT (z automatycznymi aktualizacjami)

1. Zainstaluj plugin **BRAT** (Obsidian42 - BRAT) z listy Community plugins.
2. BRAT → *Add beta plugin* → wklej: `AIBiz-Automatyzacje/obsidian-claude-launcher`
3. Włącz **Claude Code Launcher** na liście dodatków.

BRAT sam podciągnie kolejne wersje.

## Pierwsze uruchomienie

Kliknij ikonkę. Plugin przy okazji zapisze w Terminalu profil o nazwie **Claude Code** — zobaczysz go w ustawieniach Terminala i możesz go używać też ręcznie.

Twój dotychczasowy domyślny profil Terminala **zostaje nietknięty** — Launcher podmienia go tylko na ułamek sekundy, na czas otwarcia sesji, i od razu przywraca.

## Ustawienia

| Ustawienie | Domyślnie | Do czego |
|---|---|---|
| **Polecenie** | `claude` | Co ma się odpalić. Wpisz np. `claude --model opus`, jeśli chcesz startować z konkretnym modelem. |
| **Pomiń pytania o uprawnienia** | wyłączone | Dokłada `--dangerously-skip-permissions`. |
| **Katalog startowy** | katalog vaulta | Alternatywnie: folder aktywnej notatki. |
| **Utwórz / odśwież profil** | — | Przepisuje powyższe ustawienia do profilu w Terminalu od razu, bez odpalania sesji. |

### ⚠️ O „Pomiń pytania o uprawnienia"

`--dangerously-skip-permissions` wyłącza pytanie o zgodę przed każdą operacją na plikach i przed każdą komendą w terminalu. Claude może wtedy modyfikować i kasować pliki w Twoim vaultcie bez pytania.

Włączaj **tylko** na własnym komputerze, w vaultcie, który masz zbackupowany. Nie włączaj tego na firmowym sprzęcie ani w vaultcie z danymi, których nie odtworzysz.

## Nie działa?

| Objaw | Co sprawdzić |
|---|---|
| „Zainstaluj i włącz plugin Terminal" | Terminal nie jest włączony na liście dodatków. |
| „Plugin Terminal nie udostępnia komend" | W ustawieniach Terminala włącz *Add to command palette*. |
| Terminal się otwiera, ale wyskakuje `command not found: claude` | Claude Code nie jest w `PATH`. Sprawdź `which claude` w zwykłym terminalu i doinstaluj, jeśli trzeba. |
| Ikonka nic nie robi | Otwórz konsolę (`Cmd/Ctrl + Shift + I`) i poszukaj wpisów `[claude-launcher]`. |

## Licencja

MIT — rób z tym co chcesz.
