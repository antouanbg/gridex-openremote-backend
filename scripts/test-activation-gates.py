"""Test the actual pure gate function without executing privileged activation."""
import ast
from pathlib import Path
import re
import unittest

source = Path(__file__).with_name('activate-rock-mqtt.py')
tree = ast.parse(source.read_text())
function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'validate_locked_configuration')
namespace = {'re': re}
exec(compile(ast.Module(body=[function], type_ignores=[]), str(source), 'exec'), namespace)
validate = namespace['validate_locked_configuration']
names = ['ADDRESSING', 'POWER_SIGN', 'SCALING', 'INT32_WORD_ORDER']
locked = ''.join('GRIDEX_APPROVE_' + n + '=0\n' for n in names)

class GateTests(unittest.TestCase):
    def test_int32_gate_is_recognized(self):
        validate(locked)

    def test_quoted_zero_and_crlf(self):
        validate(locked.replace('=0', '=\"0\"').replace('\n', '\r\n'))

    def test_each_missing_gate_rejected(self):
        for name in names:
            with self.assertRaises(ValueError):
                validate(locked.replace('GRIDEX_APPROVE_' + name + '=0\n', ''))

    def test_unlocked_and_malformed_values_rejected(self):
        for value in ['1', 'true', '', '"0', '0 # comment', '$(echo 0)']:
            with self.assertRaises(ValueError):
                validate(locked.replace('INT32_WORD_ORDER=0', 'INT32_WORD_ORDER=' + value))

    def test_duplicate_gate_rejected(self):
        with self.assertRaises(ValueError):
            validate(locked + 'GRIDEX_APPROVE_ADDRESSING=0\n')

if __name__ == '__main__':
    unittest.main()
