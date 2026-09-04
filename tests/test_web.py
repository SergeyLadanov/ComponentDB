import base64
from datetime import timedelta
from pathlib import Path
import tempfile
import unittest

from tests.support import component, load_test_app


class ComponentApiTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.app, self.db = load_test_app(Path(self.directory.name) / 'components.sqlite')
        self.client = self.app.test_client()
        token = base64.b64encode(b'tester:testing').decode()
        self.headers = {'Authorization': f'Basic {token}'}

    def tearDown(self):
        self.db.dbhandle.close()
        self.directory.cleanup()

    def post(self, operation, **overrides):
        return self.client.post('/request_handler', data=component(reqtype=operation, **overrides), headers=self.headers)

    def rows(self, query=''):
        response = self.client.get('/get_data' + query, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        return response.json['data']

    def login(self, username='tester', password='testing'):
        token = self.client.get('/auth/session').json['csrfToken']
        return self.client.post('/login', json={'username': username, 'password': password},
                                headers={'X-CSRF-Token': token})

    def session_headers(self):
        return {'X-CSRF-Token': self.client.get('/auth/session').json['csrfToken']}

    def test_auth_required_for_page_read_and_write(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.location, '/login')
        for path in ('/get_data', '/request_handler'):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 401)
            self.assertNotIn('WWW-Authenticate', response.headers)
        response = self.client.post('/request_handler', data=component(reqtype='Add'))
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.rows(), [])

    def test_page_mounts_react_without_legacy_scripts(self):
        self.login()
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        html = response.get_data(as_text=True)
        self.assertIn('id="app"', html)
        self.assertIn('/static/dist/index.js', html)
        self.assertNotIn('jquery', html)

    def test_reverse_proxy_prefix_is_used_for_redirects_and_assets(self):
        headers = {'X-Forwarded-Prefix': '/components'}
        response = self.client.get('/', headers=headers)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.location, '/components/login')

        html = self.client.get('/login', headers=headers).get_data(as_text=True)
        self.assertIn('content="/components"', html)
        self.assertIn('/components/static/favicon.ico', html)
        self.assertIn('/components/static/dist/index.js', html)

    def test_login_page_and_session_lifecycle(self):
        self.assertEqual(self.client.get('/login').status_code, 200)
        anonymous = self.client.get('/auth/session')
        self.assertIsNone(anonymous.json['username'])
        self.assertEqual(anonymous.headers['Cache-Control'], 'no-store')
        self.assertEqual(self.login().status_code, 200)
        session_info = self.client.get('/auth/session').json
        self.assertEqual(session_info['username'], 'tester')
        self.assertNotEqual(session_info['csrfToken'], anonymous.json['csrfToken'])
        self.assertEqual(self.client.get('/login').location, '/')
        self.assertEqual(self.client.get('/').status_code, 200)
        self.assertEqual(self.client.get('/get_data').status_code, 200)
        response = self.client.post('/request_handler', data=component(reqtype='Add'), headers=self.session_headers())
        self.assertEqual(response.text, 'True')
        self.assertEqual(len(self.client.get('/get_data').json['data']), 1)
        self.assertEqual(self.client.post('/logout', headers=self.session_headers()).status_code, 200)
        self.assertEqual(self.client.get('/').location, '/login')
        self.assertEqual(self.client.get('/get_data').status_code, 401)
        self.assertEqual(self.client.post('/request_handler', data=component(reqtype='Remove', id='1')).status_code, 401)
        self.assertIsNone(self.client.get('/auth/session').json['username'])

    def test_invalid_credentials_do_not_create_session(self):
        for username, password in [('tester', 'wrong'), ('unknown', 'testing'), ('', ''), (None, []), ('tester', 'неверный')]:
            with self.subTest(username=username, password=password):
                response = self.login(username, password)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json['error'], 'Неверный логин или пароль.')
                self.assertNotIn('WWW-Authenticate', response.headers)
                self.assertIsNone(self.client.get('/auth/session').json['username'])
        self.assertEqual(self.client.post('/login', json=['tester', 'testing'], headers=self.session_headers()).status_code, 401)

    def test_csrf_required_for_login_logout_and_session_writes(self):
        self.client.get('/auth/session')
        self.assertEqual(self.client.post('/login', json={'username': 'tester', 'password': 'testing'}).status_code, 403)
        self.login()
        for headers in ({}, {'X-CSRF-Token': 'incorrect'}):
            self.assertEqual(self.client.post('/logout', headers=headers).status_code, 403)
            self.assertEqual(self.client.post('/request_handler', data=component(reqtype='Add'), headers=headers).status_code, 403)
        self.assertEqual(self.client.get('/logout').status_code, 405)
        self.assertEqual(self.client.get('/get_data').json['data'], [])
        self.assertEqual(self.client.get('/auth/session').json['username'], 'tester')

    def test_cookie_flags_and_session_expiration(self):
        response = self.login()
        cookie = response.headers['Set-Cookie']
        self.assertIn('HttpOnly', cookie)
        self.assertIn('SameSite=Lax', cookie)
        self.assertNotIn('testing', cookie)
        self.app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(seconds=-1)
        self.assertEqual(self.client.get('/get_data').status_code, 401)
        self.assertEqual(self.client.get('/').location, '/login')

    def test_tampered_cookie_cannot_authenticate(self):
        self.login()
        self.client.set_cookie(self.app.config['SESSION_COOKIE_NAME'], 'forged-session')
        self.assertEqual(self.client.get('/get_data').status_code, 401)
        self.assertEqual(self.client.get('/').location, '/login')

    def test_add_filter_edit_write_off_and_remove(self):
        self.assertEqual(self.post('Add').text, 'True')
        row = self.rows()[0]
        self.assertEqual(len(row), 12)
        self.assertEqual(row[1:11], ['Резистор', 'RC0603', '10', 'кОм', '1%', 'Тестовый компонент', '0603', 'Yageo', 5, 'A-01'])
        self.assertEqual(len(self.rows('?filter=Резистор')), 1)
        self.assertEqual(self.rows('?filter=Конденсатор'), [])
        response = self.post('Edit', id=str(row[0]), cnt='0', cellnum='B-02')
        self.assertRegex(response.text, r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$')
        self.assertEqual(self.rows()[0][9:11], [0, 'B-02'])
        self.assertEqual(self.post('Remove', id=str(row[0])).text, 'True')
        self.assertEqual(self.rows(), [])

    def test_add_duplicate_merges_quantities(self):
        self.post('Add')
        self.assertEqual(self.post('Add', cnt='2').text, 'Match')
        self.assertEqual(len(self.rows()), 1)
        self.assertEqual(self.rows()[0][9], 7)

    def test_edit_duplicate_merges_rows(self):
        self.post('Add')
        self.post('Add', name='Another part', cnt='3')
        row_id = self.rows()[1][0]
        self.assertEqual(self.post('Edit', id=str(row_id), cnt='3').text, 'Match')
        self.assertEqual(len(self.rows()), 1)
        self.assertEqual(self.rows()[0][9], 8)

    def test_invalid_quantities_cannot_modify_database(self):
        for value in ('-1', '1.5', '', 'abc', '9007199254740992', '1' * 100, '²'):
            with self.subTest(value=value):
                response = self.post('Add', cnt=value)
                self.assertEqual(response.status_code, 400)
                self.assertIn('error', response.json)
        self.assertEqual(self.rows(), [])

    def test_invalid_operation_id_and_long_fields(self):
        self.assertEqual(self.post('Unknown').status_code, 400)
        self.assertEqual(self.post('Edit', id='invalid').status_code, 400)
        self.assertEqual(self.post('Remove', id='0').status_code, 400)
        self.assertEqual(self.post('Add', name='a' * 256).status_code, 400)
        self.assertEqual(self.post('Add', group='').status_code, 400)
        self.assertEqual(self.rows(), [])

    def test_missing_position_reports_failure(self):
        self.assertEqual(self.post('Edit', id='999').text, 'False')
        self.assertEqual(self.post('Remove', id='999').text, 'False')


if __name__ == '__main__':
    unittest.main()
