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
    type_data = request.form.get('type')
    global data
    return data


@app.route('/request_handler', methods=['GET', 'POST'])
def request_handler():
    type_request = request.form.get('reqtype')

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
        db_if.addPosition(row_data)
    if type_request == "Remove":
        db_if.removePosition(row_data)
    if type_request == "Edit":
        db_if.editPosition(row_data)
    if type_request == "Sub":
        db_if.subPosition(row_data)

    print(request.form["reqtype"])

 #   print(json_data[0], json_data[1], json_data[2], json_data[3])
    return "OK"
    



if __name__ == '__main__':
    app.run(host='localhost', port=5003)
