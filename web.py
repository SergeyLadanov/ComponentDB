#!/usr/bin/env python3
from flask import Flask, render_template, request, make_response
from functools import wraps
import json
import os
import sys
import socket
import db_if


path = os.path.realpath(os.path.dirname(sys.argv[0]))

data = {'data': [
  [1,"Конденсатор", "-", 1.0, "мкФ", "1%", "10В","0603","Yageo",10,"00001","23.07.2020"],
  [2,"Конденсатор", "-", 2.0, "пФ", "1%","10В","0603","Yageo",36,"00002","23.07.2020"],
  [3,"Конденсатор", "-", 6.2, "мкФ", "1%","10В","1206","Yageo",83,"00003","23.07.2020"],
  [4,"Резистор", "-", 1.5, "кОм", "1%","10В","0805","Yageo",93,"00004","23.07.2020"],
  [5,"Резистор", "-", 2.0, "Ом", "1%","10В","0603","Yageo",36,"00002","23.07.2020"],
  [6,"Резистор", "-", 6.2, "МОм", "1%","10В","0603","Yageo",83,"00003","23.07.2020"],
  [7,"Резистор", "-", 1.5, "Ом", "1%","10В","0402","Yageo",93,"00004","23.07.2020"]
  ]}

json_string = json.dumps(data)


#------------------------------
app = Flask(__name__)

@app.route("/")
def index():
    return render_template('index.html')



@app.route('/get_data', methods=['GET', 'POST'])
def control():
    global data
    return data


@app.route('/request_handler', methods=['GET', 'POST'])
def request_handler():
    type_data = request.form.get('type')
    json_data = json.loads(request.form.get('data'))

    if type_data == "Add":
        db_if.addPosition(json_data)
    if type_data == "Remove":
        db_if.removePosition(json_data)
    if type_data == "Edit":
        db_if.editPosition(json_data)
    if type_data == "Sub":
        db_if.subPosition(json_data)



    print(json_data[0], json_data[1], json_data[2], json_data[3])
    return "OK"
    



if __name__ == '__main__':
    app.run(host='localhost', port=5003)
