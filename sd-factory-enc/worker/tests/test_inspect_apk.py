import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from inspect_apk import extract_activity_inventory, _resolve_component_name

NS = 'http://schemas.android.com/apk/res/android'

class ManifestInventoryTests(unittest.TestCase):
    def test_names_are_fully_qualified(self):
        self.assertEqual(_resolve_component_name('com.example', '.Home'), 'com.example.Home')
        self.assertEqual(_resolve_component_name('com.example', 'Home'), 'com.example.Home')
        self.assertEqual(_resolve_component_name('com.example', 'com.other.Home'), 'com.other.Home')

    def test_exported_defaults_and_aliases(self):
        xml=f'<manifest xmlns:android="{NS}"><application><activity android:name=".Home" android:exported="false"><intent-filter /></activity><activity android:name=".Legacy"><intent-filter /></activity><activity android:name=".Private" /><activity-alias android:name=".Alias" android:targetActivity=".Home"><intent-filter /></activity-alias></application></manifest>'
        root=ET.fromstring(xml)
        old={x['name']:x for x in extract_activity_inventory(root,'com.example',30)}
        self.assertFalse(old['com.example.Home']['exported'])
        self.assertTrue(old['com.example.Legacy']['exported'])
        self.assertFalse(old['com.example.Private']['exported'])
        self.assertEqual(old['com.example.Alias']['targetActivity'],'com.example.Home')
        new={x['name']:x for x in extract_activity_inventory(root,'com.example',35)}
        self.assertFalse(new['com.example.Legacy']['exported'])
        self.assertEqual(new['com.example.Legacy']['exportedSource'],'platform_default')

    def test_missing_application(self):
        self.assertEqual(extract_activity_inventory(ET.fromstring('<manifest />'),'x.y',35),[])

if __name__ == '__main__':
    unittest.main()
