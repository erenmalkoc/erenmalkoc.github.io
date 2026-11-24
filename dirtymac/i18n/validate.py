#!/usr/bin/env python3
"""Usage: python3 dirtymac/i18n/validate.py <lang code> [<lang code> ...]

The page text lives in en.json (keys marked data-i18n in ../index.html). After adding or
changing an English string, translate it into the other 16 files and run this.
Checks dirtymac/i18n/<code>.json against en.json: same keys, same HTML tags in the same order,
untouched <code> contents and shortcut, no semicolons, no empty or English-copied long text."""
import json, re, sys
import os
D = os.path.dirname(os.path.abspath(__file__)) + '/'
en = json.load(open(D + 'en.json', encoding='utf-8'))
TAG = re.compile(r'</?\w+[^>]*>')
CODE = re.compile(r'<code>(.*?)</code>', re.S)
bad = 0
for code in sys.argv[1:]:
    try:
        tr = json.load(open(D + code + '.json', encoding='utf-8'))
    except Exception as e:
        print(code, 'cannot read:', e); bad += 1; continue
    errors = []
    if set(tr) != set(en):
        errors.append(f"keys differ: missing {sorted(set(en) - set(tr))} extra {sorted(set(tr) - set(en))}")
    for k, e in en.items():
        t = tr.get(k)
        if t is None: continue
        if not isinstance(t, str) or not t.strip(): errors.append(f'{k}: empty'); continue
        if TAG.findall(e) != TAG.findall(t): errors.append(f'{k}: tags differ {TAG.findall(e)} vs {TAG.findall(t)}')
        if CODE.findall(e) != CODE.findall(t): errors.append(f'{k}: <code> content changed')
        if '⌃⌥⌘K' in e and '⌃⌥⌘K' not in t: errors.append(f'{k}: shortcut missing')
        if ';' in re.sub(r'&\w+;', '', t): errors.append(f'{k}: contains a semicolon')
        if code != 'en' and len(e) > 60 and t == e: errors.append(f'{k}: long text left in English')
        if len(t) > 3 * len(e) + 20: errors.append(f'{k}: suspiciously long ({len(t)} vs {len(e)})')
    if errors:
        bad += 1
        print(code, 'FAILED'); [print('  ', x) for x in errors[:25]]
    else:
        print(code, 'ok', len(tr), 'keys')
sys.exit(1 if bad else 0)
