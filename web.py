#!/usr/bin/env python3
from flask import Flask, render_template, request, make_response
from functools import wraps
import json
import os
import sys
import socket
import db_if

# Текущий путь приложения
path = os.path.realpath(os.path.dirname(sys.argv[0]))
try:
    import config
except ModuleNotFoundError:
    print("This is the first start of application")
    config_content =  '''#----Настройки WEB сервера----#
# Хост WEB сервера
HTTP_HOST = "localhost"
# Порт WEB сервера
HTTP_PORT = 5000
# Учетные записи для доступа к серверу
ACCOUNTS = ["user1:pswd1", "user2:pswd2"]
#----Настройки подключения к базе данных----#
# Хост для подключения к БД
DB_HOST = "localhost"
# Имя пользователя БД
DB_USER = ""
# Имя БД
DB_NAME = ""
# Пароль БД
DB_PSWD = ""'''

    f = open('config.py', 'w')
    f.write(config_content)
    f.close()
    print("Config file was created, please config application and restart it")
    exit(0)


#------------------------------
app = Flask(__name__)

@app.route("/")
def index():
    return render_template('index.html')


# Чтение базы данных
@app.route('/get_data', methods=['GET', 'POST'])
def control():
    type_data = request.args.get('filter')
    data = db_if.getData(type_data)
    return data

# Обработка запроса на изменение базы данных
@app.route('/request_handler', methods=['GET', 'POST'])
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
    



if __name__ == '__main__':
    app.run(host='localhost', port=5003)
