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

## Instalacja — przez BRAT (zalecane)

Wszystko klikasz w Obsidianie, nic nie kopiujesz do folderów. Aktualizacje przychodzą same.

1. Obsidian → **Ustawienia** → **Dodatki** (Community plugins) → **Przeglądaj** → wyszukaj **BRAT** → *Install* → *Enable*.
2. Otwórz paletę komend (`Cmd/Ctrl + P`) i wpisz **BRAT: Add a beta plugin for testing**.
3. W polu adresu wklej:
   ```
   AIBiz-Automatyzacje/obsidian-claude-launcher
   ```
4. Zostaw *Latest version*, kliknij **Add Plugin**.
5. Wróć na listę dodatków i włącz **Claude Code Launcher**.

Ikonka z maskotką pojawi się w lewym pasku. BRAT sam podciągnie kolejne wersje.

> Nie masz jeszcze pluginu **Terminal**? Zainstaluj go tak samo jak BRAT w kroku 1 — Launcher bez niego nie ruszy.

<details>
<summary>Instalacja ręczna (bez BRAT)</summary>

1. Pobierz `claude-launcher.zip` z [ostatniego release'u](../../releases/latest).
2. Rozpakuj do `<twój-vault>/.obsidian/plugins/` — ma powstać folder `claude-launcher` z plikami `main.js` i `manifest.json`.
3. Obsidian → Ustawienia → Dodatki → odśwież listę → włącz **Claude Code Launcher**.

Folder `.obsidian` jest ukryty. Na macOS pokażesz go w Finderze skrótem `Cmd + Shift + .`, na Windowsie zaznacz *Ukryte elementy* w zakładce Widok.

Tą drogą aktualizacje trzeba wgrywać ręcznie.
</details>

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
| Windows: obok Obsidiana otwiera się osobne czarne okno konsoli | Profil sprzed aktualizacji. Zaktualizuj plugin i kliknij **Utwórz / odśwież profil** w jego ustawieniach. |
| Windows: `Input must be provided either through stdin…` | To samo — odśwież profil. Claude dostał wtedy sesję bez konsoli i wszedł w tryb `--print`. |
| Windows: `Terminal resizer exited unexpectedly: 9009` | Terminal szukał `python3`, którego na Windowsie nie ma. Zaktualizuj plugin i odśwież profil. |
| Windows: tekst w terminalu połamany, ramki rozjechane | Brakuje Pythona z `psutil` i `pywinctl` — patrz sekcja niżej. |

### Windows — doinstaluj Pythona, inaczej terminal wygląda źle

Sesja na Windowsie jedzie przez `conhost.exe`, a oknem tej konsoli steruje pomocniczy skrypt Pythona wbudowany w plugin Terminal. Ten skrypt robi dwie rzeczy: **chowa okno konsoli** i **skaluje ją do szerokości panelu** Obsidiana.

Bez niego okno wprawdzie się nie pokaże, ale konsola zostanie na sztywnym rozmiarze — tekst zacznie się łamać w losowych miejscach, a ramki interfejsu Claude'a rozjadą się na kawałki.

Żeby to działało:

1. Zainstaluj Pythona z [python.org](https://www.python.org/downloads/windows/) (zaznacz *Add python.exe to PATH*).
2. W PowerShellu wykonaj:
   ```
   pip install psutil pywinctl
   ```
3. W Obsidianie: ustawienia **Claude Code Launcher** → **Utwórz / odśwież profil**.

Launcher sam znajdzie interpreter (`py`, `python`, `python3`) i sprawdzi, czy ma potrzebne biblioteki. Jak nie znajdzie, powie o tym powiadomieniem i po prostu wystartuje bez skalowania.

Na macOS i Linuksie nic nie robisz — tam Python jest częścią systemu.

## Licencja

MIT — rób z tym co chcesz.
