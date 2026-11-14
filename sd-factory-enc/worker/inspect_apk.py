#!/usr/bin/env python3
"""Real APK inventory worker. No APK modification/protection is claimed here."""
import argparse, hashlib, json, os, sys
from androguard.core.apk import APK


def inspect(path: str) -> dict:
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    if os.path.getsize(path) > 512 * 1024 * 1024:
        raise ValueError('APK exceeds the 512 MiB inspection limit')
    digest = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            digest.update(block)
    apk = APK(path)
    if not apk.is_valid_APK():
        raise ValueError('Invalid APK archive')
    activities = []
    for name in sorted(set(apk.get_activities() or [])):
        activities.append({
            'name': name,
            'exported': bool(apk.get_attribute_value('activity', 'exported', format_value=False))
                if False else None,
            'eligible': True,
            'selectionDefault': False,
        })
    return {
        'valid': True,
        'sha256': digest.hexdigest(),
        'packageName': apk.get_package(),
        'versionName': apk.get_androidversion_name(),
        'versionCode': apk.get_androidversion_code(),
        'minSdk': apk.get_min_sdk_version(),
        'targetSdk': apk.get_target_sdk_version(),
        'permissions': sorted(set(apk.get_permissions() or [])),
        'activities': activities,
        'dexFiles': [n for n in apk.get_files() if n == 'classes.dex' or (n.startswith('classes') and n.endswith('.dex'))],
        'nativeLibraries': sorted(n for n in apk.get_files() if n.startswith('lib/') and n.endswith('.so')),
        'signing': 'signature-presence-not-verified-by-this-inspector',
        'protection': {'available': False, 'reason': 'Native DEX transformation engine not deployed'},
    }

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('apk')
    p.add_argument('--json', action='store_true')
    args = p.parse_args()
    try:
        result = inspect(args.apk)
        print(json.dumps(result, indent=2))
    except Exception as exc:
        print(json.dumps({'error': type(exc).__name__, 'message': str(exc)}), file=sys.stderr)
        sys.exit(2)
