"""Load the real Flask routes and Peewee model against a disposable SQLite file."""
import importlib.util
from pathlib import Path
import sys
from types import ModuleType
from unittest.mock import patch

from peewee import SqliteDatabase

ROOT = Path(__file__).resolve().parents[1]


def load_test_app(database_path):
    config = ModuleType('config')
    config.HTTP_HOST = '127.0.0.1'
    config.HTTP_PORT = 5055
    config.ACCOUNTS = ['tester:testing']
    for field in ('DB_NAME', 'DB_USER', 'DB_PSWD', 'DB_HOST'):
        setattr(config, field, 'test')
    config.DB_PORT = 3306
    database = SqliteDatabase(str(database_path))

    def load(name, filename):
        spec = importlib.util.spec_from_file_location(name, ROOT / filename)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    with patch.dict(sys.modules, {'config': config}):
        with patch('peewee.MySQLDatabase', return_value=database):
            db_module = load('componentdb_test_database', 'db_if.py')
        with patch.dict(sys.modules, {'db_if': db_module}):
            web = load('componentdb_test_web', 'web.py')

    # The test module has a synthetic import name; keep Flask's asset paths explicit.
    web.app.template_folder = str(ROOT / 'templates')
    web.app.static_folder = str(ROOT / 'static')
    web.app.config['TESTING'] = True
    return web.app, db_module


def component(**overrides):
    data = dict(group='Резистор', name='RC0603', value='10', unit='кОм',
                tol='1%', description='Тестовый компонент', case='0603',
                manufacturer='Yageo', cnt='5', cellnum='A-01')
    data.update(overrides)
    return data
