#!/usr/bin/env python3
from flask import Flask, render_template, request, redirect, session, url_for
from datetime import timedelta
from functools import wraps
import os
import secrets
from werkzeug.middleware.proxy_fix import ProxyFix


# Текущий путь приложения
path = os.path.dirname(os.path.abspath(__file__))
try:
    from config import HTTP_HOST
    from config import HTTP_PORT
    from config import ACCOUNTS
except ModuleNotFoundError as error:
    if error.name != 'config':
        raise
    print("This is the first start of application")
    config_content =  '''#----WEB server settings----#
# WEB server host
HTTP_HOST = "localhost"
# WEB server port
HTTP_PORT = 5000
# Userts and passwords
ACCOUNTS = ["user1:pswd1", "user2:pswd2"]
#----Database settings----#
# Host for mySQL database
DB_HOST = "localhost"
# Port for mySQL database
DB_PORT = 3306
# User of database
DB_USER = ""
# Name of database
DB_NAME = ""
# Password for database
DB_PSWD = ""
#-----Backup settings-----#
# Using relative path
RELATIVE_PATH = True
# Path for saving dump
DUMP_PATH = "/dump/dump.sql"'''

    with open(os.path.join(path, 'config.py'), 'w', encoding='utf-8') as config_file:
        config_file.write(config_content)
    print("Config file was created, please config application and restart it")
    exit(0)

# Импорт модуля для работы с БД
import db_if

# Учетные записи общие для страницы входа и API.
def checkAuth(username, password):
    if not isinstance(username, str) or not isinstance(password, str):
        return False
    for item in ACCOUNTS:
        usr, separator, pswd = item.partition(':')
        if separator and usr == username and secrets.compare_digest(pswd.encode(), password.encode()):
            return True
    return False


def session_username():
    username = session.get('username')
    return username if username and any(item.partition(':')[0] == username for item in ACCOUNTS) else None


def valid_csrf():
    token = session.get('csrf_token')
    supplied = request.headers.get('X-CSRF-Token', '')
    return bool(token and secrets.compare_digest(token.encode(), supplied.encode()))


# Декоратор авторизации
def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if session_username():
            if request.endpoint == 'request_handler' and not valid_csrf():
                return {'error': 'Сессия изменилась. Обновите страницу и повторите попытку.'}, 403
            return f(*args, **kwargs)
        # Basic Auth остается доступен для существующих клиентов API.
        auth = request.authorization
        if request.endpoint != 'index' and auth and auth.type == 'basic' and checkAuth(auth.username, auth.password):
            return f(*args, **kwargs)
        if request.endpoint == 'index':
            return redirect(url_for('login'))
        return {'error': 'Требуется авторизация.'}, 401
    return decorated
#------------------------------
app = Flask(__name__)
# Учитываем префикс, переданный доверенным reverse proxy в
# X-Forwarded-Prefix (например, /components).
app.wsgi_app = ProxyFix(
    app.wsgi_app,
    x_for=1,
    x_proto=1,
    x_host=1,
    x_prefix=1,
)
app.config.update(
    SECRET_KEY=os.environ.get('COMPONENTDB_SECRET_KEY') or secrets.token_hex(32),
    SESSION_COOKIE_NAME='componentdb_session',
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=os.environ.get('COMPONENTDB_COOKIE_SECURE') == '1',
    PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
    SESSION_REFRESH_EACH_REQUEST=False,
)


@app.after_request
def prevent_private_caching(response):
    if request.endpoint != 'static':
        response.headers['Cache-Control'] = 'no-store'
    return response


@app.route('/auth/session')
def auth_session():
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_urlsafe(32)
    return {'username': session_username(), 'csrfToken': session['csrf_token']}


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        if session_username():
            return redirect(url_for('index'))
        return render_template('index.html')
    if not valid_csrf():
        return {'error': 'Сессия изменилась. Обновите страницу и повторите попытку.'}, 403
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not checkAuth(data.get('username'), data.get('password')):
        return {'error': 'Неверный логин или пароль.'}, 401
    session.clear()
    session.permanent = True
    session['username'] = data['username']
    session['csrf_token'] = secrets.token_urlsafe(32)
    return {'username': session['username']}


@app.route('/logout', methods=['POST'])
def logout():
    if not valid_csrf():
        return {'error': 'Сессия изменилась. Обновите страницу и повторите попытку.'}, 403
    session.clear()
    return {'ok': True}

# Корневой каталог
@app.route("/")
@auth_required
def index():
    return render_template('index.html')


# Чтение базы данных
@app.route('/get_data', methods=['GET', 'POST'])
@auth_required
def control():
    type_data = request.args.get('filter', '')
    data = db_if.getData(type_data)
    return data

# Обработка запроса на изменение базы данных
@app.route('/request_handler', methods=['GET', 'POST'])
@auth_required
def request_handler():
    type_request = request.form.get('reqtype')
    if type_request not in ('Add', 'Edit', 'Remove'):
        return {'error': 'Неизвестная операция.'}, 400
    repply = "OK"
    row_data = {
        "id": request.form.get('id'), 
        "group": request.form.get('group'),
        "name": request.form.get('name'),
        "value": request.form.get('value'),
        "unit": request.form.get('unit'),
        "tol": request.form.get('tol'),
        "description": request.form.get('description'),
        "case": request.form.get('case'),
        "manufacturer": request.form.get('manufacturer'),
        "cnt": request.form.get('cnt'),
        "cellnum": request.form.get('cellnum')
    }

    if type_request in ('Edit', 'Remove'):
        row_id = row_data['id'] or ''
        if not row_id.isascii() or not row_id.isdigit() or len(row_id) > 19 or int(row_id) <= 0:
            return {'error': 'Некорректный ID позиции.'}, 400

    if type_request != 'Remove':
        quantity = row_data['cnt'] or ''
        if not quantity.isascii() or not quantity.isdigit() or len(quantity) > 16 or int(quantity) > 9007199254740991:
            return {'error': 'Количество должно быть целым неотрицательным числом.'}, 400
        if not row_data['group']:
            return {'error': 'Укажите тип компонента.'}, 400
        for key in ('group', 'name', 'value', 'unit', 'tol', 'description', 'case', 'manufacturer', 'cellnum'):
            row_data[key] = row_data[key] or ''
            if len(row_data[key]) > 255:
                return {'error': 'Значение поля не должно превышать 255 символов.'}, 400

    if type_request == "Add":
        repply = db_if.addPosition(row_data)
    if type_request == "Remove":
        repply = db_if.removePosition(row_data)
    if type_request == "Edit":
        repply = db_if.editPosition(row_data)

    return repply
    


# Запуск приложения
if __name__ == '__main__':
    app.run(host=HTTP_HOST, port=HTTP_PORT)
