#!/usr/bin/env python3
"""Writes dirtymac/strings.json for the panel demo on the product page.

The demo shows the app's own texts in the app's own 17 languages, so they are
taken from the app's string catalog instead of being retyped. Run it after a
release that changes a panel or Settings text:

    python3 dirtymac/extract-strings.py ~/XCodeProjects/dirtymac/dirtymac/Localizable.xcstrings

Only the keys listed below are kept (about 50 of the catalog's 130), so the
file stays small. A key missing from the catalog stops the script.
"""
import json
import sys

KEYS = [
    # the panel
    "Keyboard utility", "Ready", "Locked", "Click to Lock Keyboard",
    "Mouse and trackpad stay enabled.", "Mouse and trackpad will be frozen too.",
    "Cleaning Mode Active", "Unlocks in %@", "Hold Esc for 3 seconds to unlock.",
    "Unlocking in %lld…", "Let go of Esc.", "Locking in %lld…", "Cancel",
    "Lock Keyboard", "Unlock Keyboard", "Full Lockdown",
    "Your mouse and trackpad will be frozen too. To unlock: hold Esc for 3 seconds, or wait for the auto-unlock timer.",
    "The keyboard stays locked for %@ unless you unlock it sooner.",
    "Hold Esc for 3 seconds to check that your way out works.",
    "Esc works. You can lock now.", "Quit", "Settings", "Back",
    # Settings
    "Mode", "Basic", "Advanced", "Block modifier keys", "Block media & brightness keys",
    "Block mouse & trackpad", "Auto-unlock", "Off",
    "Mouse will be frozen. Hold Esc for 3s to force unlock.",
    "With the mouse frozen, the lock lasts at most %@. Above %@, dirtymac asks you to hold Esc first to check your way out.",
    "Before locking", "Start delay",
    "Waits a few seconds after you click Lock, so you can take your hands off the keyboard. Cancel stops it.",
    "While locked", "Keep the screen awake",
    "Stops the screen from dimming or going to sleep while the keyboard is locked, so the screen saver or a screen lock does not end the lock.",
    "Ignore scrolling and clicks",
    "While the keyboard is locked, scrolling, gestures and clicks do nothing, so a palm on the trackpad changes nothing. The dirtymac icon and panel still respond, and the cursor still moves.",
    "Turn off trackpad gestures",
    "Swipes with three or four fingers, which switch screens or open Mission Control, are turned off while the keyboard is locked and come back when it unlocks. The Dock restarts briefly each time. If dirtymac quits unexpectedly, they come back the next time it opens.",
    "Sound", "Play sounds", "Appearance", "System", "Light", "Dark", "Language",
    "Quick Access", "Global shortcut", "Open at login", "Updates", "Check for updates",
    "dirtymac takes your privacy seriously, so it stays offline by default. If you like, you can allow it to check once a day whether a new version is out. Only the latest version number is requested from GitHub. No personal data or usage information leaves your Mac. As with any web request, GitHub can see your IP address.",
    "Check now", "Checking…", "dirtymac is up to date.", "Help", "Show Welcome Screen", "What's New",
]

# Endonyms, as the app lists them (LanguagePreference.nativeName).
NAMES = {
    "de": "Deutsch", "en": "English", "es": "Español", "fr": "Français", "it": "Italiano",
    "tr": "Türkçe", "ru": "Русский", "ko": "한국어", "ja": "日本語", "pl": "Polski",
    "nl": "Nederlands", "uk": "Українська", "vi": "Tiếng Việt", "id": "Bahasa Indonesia",
    "pt-BR": "Português (Brasil)", "zh-Hans": "简体中文", "zh-Hant": "繁體中文",
}

catalog = json.load(open(sys.argv[1], encoding="utf-8"))["strings"]
missing = [k for k in KEYS if k not in catalog]
if missing:
    sys.exit("missing from the catalog: " + ", ".join(missing))

# LanguagePreference.allCases, the order of the app's own picker.
languages = ["de", "en", "es", "fr", "it", "tr", "ru", "ko", "ja", "pl", "nl", "uk", "vi", "id", "pt-BR", "zh-Hans", "zh-Hant"]
assert sorted(languages) == sorted(NAMES)
out = {"names": NAMES, "order": languages, "strings": {}}
for code in languages:
    out["strings"][code] = {
        key: catalog[key]["localizations"][code]["stringUnit"]["value"] for key in KEYS
    }

path = __file__.rsplit("/", 1)[0] + "/strings.json"
with open(path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(f"{len(KEYS)} keys x {len(languages)} languages -> {path}")
