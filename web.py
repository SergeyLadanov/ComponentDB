#!/usr/bin/env python3
from flask import Flask, render_template, request, make_response
from functools import wraps
import json
import os
import sys
import socket


path = os.path.realpath(os.path.dirname(sys.argv[0]))

data = {'data': [
  ["Конденсатор", "-", "1", "мкФ", "1%","10В","0603","Yageo",10,""],
  ["Конденсатор", "-", "2", "пФ", "1%","10В","0603","Yageo",36,""],
  ["Конденсатор", "-", "6.2", "мкФ", "1%","10В","0603","Yageo",83,""],
  ["Конденсатор", "-", "1,5", "мкФ", "1%","10В","0603","Yageo",93,""]
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
    



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5003)
