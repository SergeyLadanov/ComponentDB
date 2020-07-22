import peewee
from peewee import *

 
user = 'root'
password = '12345678'
db_name = 'Components'
 
dbhandle = MySQLDatabase(
    db_name, user=user,
    password=password,
    host='localhost'
)


dbhandle.connect()
print("Test")
