#!/usr/bin/env python3
"""Read-only APK inventory worker. It never modifies or protects an APK."""
import argparse, hashlib, json, os, sys
from typing import Any

ANDROID_NS = '{http://schemas.android.com/apk/res/android}'
MAX_APK_BYTES = 512 * 1024 * 1024

def _resolve_component_name(package: str, name: str | None) -> str | None:
    if not name: return None
    if name.startswith('.'): return package + name
    if '.' not in name: return package + '.' + name
    return name

def extract_activity_inventory(manifest_root: Any, package: str, target_sdk: int | None) -> list[dict]:
    """Read Activity declarations and calculate exported defaults from the manifest."""
    application = manifest_root.find('application')
    if application is None: return []
    inventory = []
    for tag in ('activity', 'activity-alias'):
        for node in application.findall(tag):
            name = _resolve_component_name(package, node.get(ANDROID_NS + 'name'))
            if not name: continue
            filters = len(node.findall('intent-filter'))
            explicit = node.get(ANDROID_NS + 'exported')
            if explicit is not None:
                exported, source = explicit.strip().lower() == 'true', 'manifest'
            else:
                # Pre-Android 12 defaults to exported=true only when filters exist.
                exported, source = bool(filters) if (target_sdk or 1) < 31 else False, 'platform_default'
            inventory.append({
                'name': name, 'componentType': tag,
                'targetActivity': _resolve_component_name(package, node.get(ANDROID_NS + 'targetActivity')) if tag == 'activity-alias' else None,
                'exported': exported, 'exportedSource': source, 'intentFilterCount': filters,
                'eligible': True, 'selectionDefault': False
            })
    return sorted(inventory, key=lambda item: item['name'])

def inspect(path: str) -> dict:
    if not os.path.isfile(path): raise FileNotFoundError(path)
    size = os.path.getsize(path)
    if size <= 0: raise ValueError('APK file is empty')
    if size > MAX_APK_BYTES: raise ValueError('APK exceeds the 512 MiB inspection limit')
    try:
        from androguard.core.apk import APK
    except ImportError as exc:
        raise RuntimeError('Androguard is not installed; install worker/requirements.txt') from exc
    apk = APK(path)
    if not apk.is_valid_APK(): raise ValueError('Invalid APK archive')
    package = apk.get_package() or ''
    target_raw = apk.get_target_sdk_version()
    try: target = int(target_raw) if target_raw is not None else None
    except (TypeError, ValueError): target = None
    manifest = apk.get_android_manifest_xml()
    activities = extract_activity_inventory(manifest, package, target)
    files = apk.get_files()
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''): digest.update(block)
    return {
        'valid': True, 'fileSize': size, 'sha256': digest.hexdigest(), 'packageName': package,
        'versionName': apk.get_androidversion_name(), 'versionCode': apk.get_androidversion_code(),
        'minSdk': apk.get_min_sdk_version(), 'targetSdk': target_raw,
        'permissions': sorted(set(apk.get_permissions() or [])), 'activities': activities,
        'activityCount': len(activities),
        'dexFiles': sorted(n for n in files if n == 'classes.dex' or (n.startswith('classes') and n.endswith('.dex'))),
        'nativeLibraries': sorted(n for n in files if n.startswith('lib/') and n.endswith('.so')),
        'signing': {'verified': False, 'status': 'not_verified', 'message': 'Use apksigner verify --verbose --print-certs for cryptographic verification.'},
        'protection': {'available': False, 'status': 'disabled', 'reason': 'Native DEX transformation and runtime loader are not deployed or device-validated.'}
    }

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apk')
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()
    try: print(json.dumps(inspect(args.apk), indent=2))
    except Exception as exc:
        print(json.dumps({'error': type(exc).__name__, 'message': str(exc)}), file=sys.stderr)
        sys.exit(2)
