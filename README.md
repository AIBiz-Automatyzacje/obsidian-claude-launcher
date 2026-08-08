# Claude Code Launcher

Ikonka w lewym pasku Obsidiana, która odpala Claude Code w terminalu wewnątrz vaulta. Jedno kliknięcie zamiast przełączania się do Terminala, szukania ścieżki i wklepywania `cd`.

Claude startuje od razu w katalogu Twojego vaulta, więc widzi wszystkie notatki i może w nich pracować.

---

## Spis treści

- [Co dokładnie robi](#co-dokładnie-robi)
- [Zanim zaczniesz](#zanim-zaczniesz)
- [Instalacja](#instalacja)
- [Windows: nic do zrobienia](#windows-nic-do-zrobienia)
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
- **Ctrl+C i Ctrl+V działają tak, jak się spodziewasz** (Windows i Linux). Sam plugin Terminal tego nie potrafi, bo w jego mapowaniach klawiszy nie ma nawet akcji „wklej".
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

## Windows: nic do zrobienia

Wcześniejsze wersje wymagały na Windowsie doinstalowania Pythona z bibliotekami `psutil` i `pywinctl` — bez nich tekst łamał się w przypadkowych miejscach, a ramki interfejsu Claude'a rozjeżdżały się na kawałki.

Od wersji 1.4.0 nie jest już potrzebny. Launcher skaluje konsolę własnym pomocnikiem w PowerShellu, który jest częścią każdej instalacji Windows.

Jeśli masz Pythona zainstalowanego pod ten plugin, możesz go zostawić — nie przeszkadza, po prostu nie jest już używany.

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
| **Po kliknięciu ikonki uruchomi się** | — | Podgląd polecenia, które faktycznie poleci. Aktualizuje się na żywo |
| **Polecenie** | `claude` | Co ma się uruchomić w terminalu. Wpisz tu np. `claude --model opus`, jeśli chcesz startować z konkretnym modelem |
| **Tryb bypass permissions** | wyłączone | Dokłada flagę `--dangerously-skip-permissions` |
| **Katalog startowy** | katalog vaulta | Druga opcja to folder notatki, którą masz akurat otwartą |
| **Utwórz / odśwież profil** | — | Przepisuje powyższe ustawienia do profilu w Terminalu od razu, bez otwierania sesji |

Zmiana działa od następnego kliknięcia ikonki, bez restartu Obsidiana.

### Zanim włączysz tryb bypass permissions

Domyślnie Claude Code pyta o zgodę, zanim zmieni plik albo uruchomi komendę w terminalu. Flaga `--dangerously-skip-permissions` wyłącza te pytania, przez co Claude może modyfikować i kasować pliki w Twoim vaultcie bez ostrzeżenia.

Włączaj ją tylko na własnym komputerze i w vaultcie, który masz zbackupowany. Na sprzęcie firmowym albo w vaultcie z danymi, których nie odtworzysz, lepiej tego nie ruszać.

---

## Kopiowanie i wklejanie

Na Windowsie i Linuksie **Ctrl+V wkleja, a Ctrl+C kopiuje zaznaczony tekst**. Plugin przejmuje te dwa skróty w oknie terminala i obsługuje je sam.

Jeden wyjątek jest celowy: **Ctrl+C bez zaznaczenia przerywa uruchomiony program**, tak jak w każdym terminalu. Inaczej nie dałoby się zatrzymać tego, co akurat chodzi. Chcesz skopiować, więc najpierw zaznacz myszą.

Działa też prawy przycisk myszy: z zaznaczeniem kopiuje, bez zaznaczenia wkleja.

Na macOS nic nie zmieniamy, bo Cmd+C i Cmd+V działają tam od zawsze.

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
| Windows: tekst połamany, ramki rozjechane, fragmenty w losowych miejscach | Naprawione w 1.4.0. Zaktualizuj plugin i kliknij **Utwórz / odśwież profil** |
| Windows: obok Obsidiana wyskakuje osobne czarne okno konsoli | To samo — od 1.4.0 okno konsoli startuje ukryte |
| Kolory terminala wyglądają inaczej niż na screenach | Od 1.4.0 terminal ma własną, stałą paletę zamiast kolorów motywu Obsidiana. Kliknij **Utwórz / odśwież profil** |
| Windows: `Input must be provided either through stdin…` | Profil pochodzi ze starej wersji pluginu. Zaktualizuj i kliknij **Utwórz / odśwież profil** |
| Ikonka nic nie robi | Otwórz konsolę deweloperską (`Cmd/Ctrl + Shift + I`) i poszukaj wpisów zaczynających się od `[claude-launcher]` |

---

## Jak to działa pod spodem

Ta sekcja jest dla ciekawych, do korzystania z pluginu nie jest potrzebna.

Plugin Terminal umie otwierać sesje wyłącznie według profili zapisanych we własnych ustawieniach i udostępnia komendę tylko dla profilu oznaczonego jako domyślny. Launcher wchodzi więc do jego ustawień przez `settings.mutate()`, dopisuje własny profil pod stałym identyfikatorem, na moment ustawia go jako domyślny, wywołuje komendę i przywraca poprzedni. Terminal odczytuje profil synchronicznie w chwili wykonania komendy, więc przywrócenie zaraz potem niczego nie psuje.

Profil jest nadpisywany przy każdym kliknięciu ikonki, dzięki czemu naprawia się sam po aktualizacji pluginu albo zmianie ustawień.

Profil narzuca też wygląd terminala: własną paletę kolorów i czcionkę o stałej szerokości. To nie kosmetyka. Terminal domyślnie dziedziczy kolory i czcionkę z motywu Obsidiana, a jeśli motyw podsuwa czcionkę o zmiennej szerokości znaku, siatka terminala rozjeżdża się i tekst nachodzi na siebie.

Na Windowsie dochodzą dwie rzeczy, które muszą chodzić w parze:

- **conhost.exe** jest jedynym źródłem prawdziwej konsoli, bo Terminal spawnuje proces zawsze na strumieniach typu pipe. Bez conhosta Claude nie wykrywa terminala i przechodzi w tryb `--print`, w którym oczekuje jednorazowego pytania zamiast rozmowy.
- **Rozmiar tej konsoli** musi się zgadzać z rozmiarem xterma w panelu. Jeśli się rozjedzie, Claude rysuje interfejs dla jednej szerokości, a panel wyświetla go w innej — stąd połamane ramki i fragmenty tekstu w losowych miejscach.

Drugą rzecz Launcher załatwia dwuetapowo, bez Pythona:

1. Przy starcie sesji szacuje, ile znaków zmieści panel, i ustawia konsolę poleceniem `mode con` jeszcze zanim Claude cokolwiek narysuje.
2. Zaraz potem podłącza własnego pomocnika w PowerShellu, który przez WinAPI (`AttachConsole`, `SetConsoleScreenBufferSize`, `SetConsoleWindowInfo`) trzyma konsolę w rozmiarze xterma i reaguje na każdą zmianę wielkości panelu.

Pomocnik dostaje na wejściu PID konsoli, a potem kolejne rozmiary w formacie `KOLUMNYxWIERSZE`. Kończy się razem z sesją.

---

## Odinstalowanie

1. **Ustawienia** → **Dodatki** → wyłącz **Claude Code Launcher** i kliknij ikonę kosza
2. Opcjonalnie w ustawieniach pluginu Terminal usuń profil o nazwie **Claude Code**

---

## Licencja

MIT. Rób z tym co chcesz.
