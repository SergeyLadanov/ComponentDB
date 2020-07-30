#!/usr/bin/env python3
from flask import Flask, render_template, request, make_response
from functools import wraps
import json
import os
import sys
import socket


# Текущий путь приложения
path = os.path.realpath(os.path.dirname(sys.argv[0]))
try:
    from config import HTTP_HOST
    from config import HTTP_PORT
    from config import ACCOUNTS
except:
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
# User of database
DB_USER = ""
# Name of database
DB_NAME = ""
# Password for database
DB_PSWD = ""'''

    f = open(path+'/config.py', 'w')
    f.write(config_content)
    f.close()
    print("Config file was created, please config application and restart it")
    exit(0)

# Импорт модуля для работы с БД
import db_if

# Организация базовой авторизации
def checkAuth(username, password):
    for item in ACCOUNTS:
        record = item.split(':')
        usr = record[0]
        pswd = record[1]
        if usr == username and pswd == password:
            return True
    return False

# Декоратор авторизации
def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if auth and checkAuth(auth.username, auth.password):
            return f(*args, **kwargs)
        return make_response('Authorization failed!', 401, {'WWW-Authenticate' : 'Basic realm="Login Required"'})
    return decorated
#------------------------------
app = Flask(__name__)

# Корневой каталог
@app.route("/")
@auth_required
def index():
    return render_template('index.html')


# Чтение базы данных
@app.route('/get_data', methods=['GET', 'POST'])
@auth_required
def control():
    type_data = request.args.get('filter')
    data = db_if.getData(type_data)
    return data

# Обработка запроса на изменение базы данных
@app.route('/request_handler', methods=['GET', 'POST'])
@auth_required
def request_handler():
    type_request = request.form.get('reqtype')
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

    if type_request == "Add":
        repply = db_if.addPosition(row_data)
    if type_request == "Remove":
        repply = db_if.removePosition(row_data)
    if type_request == "Edit":
        repply = db_if.editPosition(row_data)

    return repply
    


# Запуск приложения
if __name__ == '__main__':
    app.run(host='localhost', port=HTTP_PORT)
