# Claude Code Launcher

Ikonka w lewym pasku Obsidiana, która odpala Claude Code w terminalu wewnątrz vaulta. Jedno kliknięcie zamiast przełączania się do Terminala, szukania ścieżki i wklepywania `cd`.

Claude startuje od razu w katalogu Twojego vaulta, więc widzi wszystkie notatki i może w nich pracować.

---

## Spis treści

- [Co dokładnie robi](#co-dokładnie-robi)
- [Zanim zaczniesz](#zanim-zaczniesz)
- [Instalacja](#instalacja)
- [Windows: jeszcze jeden krok](#windows-jeszcze-jeden-krok)
- [Pierwsze uruchomienie](#pierwsze-uruchomienie)
- [Ustawienia](#ustawienia)
- [Aktualizacje](#aktualizacje)
- [Co robić, kiedy nie działa](#co-robić-kiedy-nie-działa)
- [Jak to działa pod spodem](#jak-to-działa-pod-spodem)
- [Odinstalowanie](#odinstalowanie)

---

## Co dokładnie robi

Po instalacji w lewym pasku Obsidiana pojawia się ikonka z maskotką Claude Code. Klikasz i w panelu obok otwiera się terminal z uruchomioną sesją.

- Sesja startuje w katalogu vaulta (możesz to zmienić na folder aktualnie otwartej notatki).
- Po wyjściu z Claude'a zostaje otwarta powłoka, więc terminal nie zamyka się w połowie roboty.
- Możesz mieć kilka sesji naraz, każdą w osobnej zakładce.
- To samo znajdziesz w palecie komend pod nazwą **Otwórz nową sesję Claude Code**, więc da się podpiąć pod skrót klawiszowy.

Plugin sam zakłada sobie profil w pluginie Terminal. Nie musisz niczego konfigurować ręcznie ani wchodzić w ustawienia Terminala.

---

## Zanim zaczniesz

Potrzebujesz trzech rzeczy:

**1. Obsidian na komputerze.** Wersja mobilna nie obsługuje terminala, więc plugin działa wyłącznie na Windowsie, macOS i Linuksie.

**2. Plugin Terminal** autorstwa polyipseity. To on rysuje terminal w Obsidianie, Launcher tylko go odpala. Instalujesz go normalnie z listy dodatków społeczności (instrukcja niżej).

**3. Claude Code zainstalowany w systemie.** Sprawdzisz to w zwykłym terminalu:

- macOS i Linux: `which claude`
- Windows (PowerShell): `Get-Command claude`

Jeśli komenda nic nie zwraca, najpierw zainstaluj Claude Code według [oficjalnej instrukcji](https://docs.claude.com/en/docs/claude-code/setup).

---

## Instalacja

Najprościej przez BRAT, czyli plugin do instalowania innych pluginów prosto z GitHuba. Wszystko klikasz w Obsidianie, nic nie kopiujesz do folderów, a aktualizacje przychodzą same.

### Krok 1: plugin Terminal

1. Obsidian → **Ustawienia** → **Dodatki** (Community plugins)
2. Jeśli widzisz komunikat o trybie ograniczonym, kliknij **Włącz dodatki**
3. **Przeglądaj** → wpisz `Terminal` → wybierz pozycję od **polyipseity**
4. **Install**, potem **Enable**

### Krok 2: BRAT

1. Ta sama lista → **Przeglądaj** → wpisz `BRAT`
2. Wybierz **Obsidian42 - BRAT** → **Install** → **Enable**

### Krok 3: Claude Code Launcher

1. Otwórz paletę komend: `Cmd + P` (macOS) lub `Ctrl + P` (Windows, Linux)
2. Wpisz `BRAT: Add a beta plugin for testing` i wybierz tę komendę
3. W polu adresu wklej:

   ```
   AIBiz-Automatyzacje/obsidian-claude-launcher
   ```

4. Zostaw zaznaczone **Latest version** i kliknij **Add Plugin**
5. Wróć na listę dodatków i włącz **Claude Code Launcher**

Ikonka z maskotką pojawi się w lewym pasku.

<details>
<summary><b>Wolisz bez BRAT? Instalacja ręczna</b></summary>

1. Pobierz plik `claude-launcher.zip` z [ostatniego wydania](../../releases/latest)
2. Rozpakuj go do folderu `.obsidian/plugins/` w swoim vaultcie. Ma powstać katalog `claude-launcher` z plikami `main.js` i `manifest.json`
3. Obsidian → **Ustawienia** → **Dodatki** → kliknij ikonę odświeżania → włącz **Claude Code Launcher**

Folder `.obsidian` jest ukryty. W Finderze pokażesz go skrótem `Cmd + Shift + .`, w Eksploratorze Windows zaznacz *Ukryte elementy* w zakładce *Widok*.

Przy tej metodzie aktualizacje wgrywasz ręcznie za każdym razem.
</details>

---

## Windows: jeszcze jeden krok

Na Windowsie terminal w Obsidianie potrzebuje pomocniczego skryptu Pythona, który jest częścią pluginu Terminal. Ten skrypt chowa okno konsoli systemowej i dopasowuje szerokość terminala do panelu.

Bez niego plugin zadziała, ale tekst będzie się łamał w przypadkowych miejscach, a ramki interfejsu Claude'a rozjadą się na kawałki.

1. Zainstaluj Pythona z [python.org](https://www.python.org/downloads/windows/). Przy instalacji zaznacz **Add python.exe to PATH**
2. Otwórz PowerShell i wykonaj:

   ```
   pip install psutil pywinctl
   ```

3. W Obsidianie: **Ustawienia** → **Claude Code Launcher** → kliknij **Utwórz / odśwież profil**

Launcher sam sprawdzi, czy w systemie jest `py`, `python` albo `python3` z tymi bibliotekami. Jak nie znajdzie, powie o tym powiadomieniem i wystartuje bez dopasowywania szerokości.

Na macOS i Linuksie nie musisz nic robić, Python jest tam częścią systemu.

---

## Pierwsze uruchomienie

Kliknij ikonkę w lewym pasku. Otworzy się panel z terminalem i uruchomionym Claude Code.

Przy okazji plugin zapisze w ustawieniach Terminala profil o nazwie **Claude Code**. Zobaczysz go na liście profili i możesz z niego korzystać także ręcznie.

Twój dotychczasowy domyślny profil Terminala zostaje nietknięty. Launcher podmienia go tylko na ułamek sekundy, na czas otwarcia sesji, i od razu przywraca poprzedni.

---

## Ustawienia

Znajdziesz je w **Ustawienia** → **Claude Code Launcher**.

| Ustawienie | Domyślnie | Do czego służy |
|---|---|---|
| **Polecenie** | `claude` | Co ma się uruchomić w terminalu. Wpisz tu np. `claude --model opus`, jeśli chcesz startować z konkretnym modelem |
| **Pomiń pytania o uprawnienia** | wyłączone | Dokłada flagę `--dangerously-skip-permissions` |
| **Katalog startowy** | katalog vaulta | Druga opcja to folder notatki, którą masz akurat otwartą |
| **Utwórz / odśwież profil** | — | Przepisuje powyższe ustawienia do profilu w Terminalu od razu, bez otwierania sesji |

### Zanim włączysz pomijanie uprawnień

Domyślnie Claude Code pyta o zgodę, zanim zmieni plik albo uruchomi komendę w terminalu. Flaga `--dangerously-skip-permissions` wyłącza te pytania, przez co Claude może modyfikować i kasować pliki w Twoim vaultcie bez ostrzeżenia.

Włączaj ją tylko na własnym komputerze i w vaultcie, który masz zbackupowany. Na sprzęcie firmowym albo w vaultcie z danymi, których nie odtworzysz, lepiej tego nie ruszać.

---

## Aktualizacje

Przy instalacji przez BRAT nowe wersje pobierają się same przy starcie Obsidiana. Możesz też wymusić sprawdzenie: paleta komend → **BRAT: Check for updates to all beta plugins**.

Po aktualizacji warto raz kliknąć **Utwórz / odśwież profil**, bo część poprawek dotyczy właśnie profilu zapisanego w Terminalu.

---

## Co robić, kiedy nie działa

| Co widzisz | Co zrobić |
|---|---|
| „Zainstaluj i włącz plugin Terminal" | Terminal nie jest włączony na liście dodatków. Wróć do kroku 1 instalacji |
| „Plugin Terminal nie udostępnia komend" | W ustawieniach pluginu Terminal włącz opcję dodawania komend do palety |
| Terminal się otwiera, ale pisze `command not found: claude` | Claude Code nie jest zainstalowany albo system go nie widzi. Sprawdź `which claude` lub `Get-Command claude` w zwykłym terminalu |
| Windows: obok Obsidiana wyskakuje osobne czarne okno konsoli | Brakuje Pythona z bibliotekami. Zobacz sekcję [Windows: jeszcze jeden krok](#windows-jeszcze-jeden-krok) |
| Windows: `Terminal resizer exited unexpectedly: 9009` | To samo. Windows nie ma polecenia `python3`, którego szukał Terminal |
| Windows: tekst połamany, ramki rozjechane | To samo, brakuje `psutil` i `pywinctl` |
| Windows: `Input must be provided either through stdin…` | Profil pochodzi ze starej wersji pluginu. Zaktualizuj i kliknij **Utwórz / odśwież profil** |
| Ikonka nic nie robi | Otwórz konsolę deweloperską (`Cmd/Ctrl + Shift + I`) i poszukaj wpisów zaczynających się od `[claude-launcher]` |

---

## Jak to działa pod spodem

Ta sekcja jest dla ciekawych, do korzystania z pluginu nie jest potrzebna.

Plugin Terminal umie otwierać sesje wyłącznie według profili zapisanych we własnych ustawieniach i udostępnia komendę tylko dla profilu oznaczonego jako domyślny. Launcher wchodzi więc do jego ustawień przez `settings.mutate()`, dopisuje własny profil pod stałym identyfikatorem, na moment ustawia go jako domyślny, wywołuje komendę i przywraca poprzedni. Terminal odczytuje profil synchronicznie w chwili wykonania komendy, więc przywrócenie zaraz potem niczego nie psuje.

Profil jest nadpisywany przy każdym kliknięciu ikonki, dzięki czemu naprawia się sam po aktualizacji pluginu albo zmianie ustawień.

Na Windowsie dochodzą dwie rzeczy, które muszą chodzić w parze:

- **conhost.exe** jest jedynym źródłem prawdziwej konsoli, bo Terminal spawnuje proces zawsze na strumieniach typu pipe. Bez conhosta Claude nie wykrywa terminala i przechodzi w tryb `--print`, w którym oczekuje jednorazowego pytania zamiast rozmowy.
- **Skrypt Pythona** z pluginu Terminal chowa okno tej konsoli i skaluje ją do rozmiaru panelu. Kiedy go brakuje, Terminal startuje wprawdzie z ukrytym oknem, ale konsola zostaje na sztywnym rozmiarze i tekst przestaje się mieścić.

Dlatego Launcher przy zapisie profilu szuka interpretera Pythona z `psutil` i `pywinctl`, a znaleziony wpisuje do profilu.

---

## Odinstalowanie

1. **Ustawienia** → **Dodatki** → wyłącz **Claude Code Launcher** i kliknij ikonę kosza
2. Opcjonalnie w ustawieniach pluginu Terminal usuń profil o nazwie **Claude Code**

---

## Licencja

MIT. Rób z tym co chcesz.
