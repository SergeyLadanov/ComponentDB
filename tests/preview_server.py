"""Disposable UI test server. Does not read config.py or connect to MySQL."""
from pathlib import Path
import tempfile

from tests.support import component, load_test_app


if __name__ == '__main__':
    with tempfile.TemporaryDirectory() as directory:
        app, db = load_test_app(Path(directory) / 'preview.sqlite')
        for index in range(1, 66):
            db.addPosition(component(name=f'RC0603-{index:03}', cnt=str(index),
                                     cellnum=f'A-{index:02}', value=str(index)))
        db.addPosition(component(group='Конденсатор', name='GRM188R71C104KA01D',
                                 value='0.1', unit='мкФ', cnt='120', manufacturer='Murata'))
        app.run(host='127.0.0.1', port=5055, debug=False, use_reloader=False)
