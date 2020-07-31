#!/usr/bin/env python3
import config
import os
import sys

if config.RELATIVE_PATH:
    path = os.path.realpath(os.path.dirname(sys.argv[0])) + config.DUMP_PATH 
else:
    path = config.DUMP_PATH

os.system("mysqldump " + "-u" + config.DB_USER + ' ' + "-p" + config.DB_PSWD + ' ' + config.DB_NAME + " > " + path)