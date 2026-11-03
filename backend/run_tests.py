"""Run all backend tests from any working directory without PYTHONPATH setup."""
import sys
import unittest
from pathlib import Path

backend = Path(__file__).resolve().parent
sys.path.insert(0, str(backend))
suite = unittest.defaultTestLoader.discover(str(backend / "app" / "tests"), pattern="test_*.py")
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
