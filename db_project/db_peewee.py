import peewee
from peewee import *
from datetime import date

 
user = 'root'
password = '12345678'
db_name = 'test'
 
dbhandle = MySQLDatabase(
    db_name, user=user,
    password=password,
    host='localhost'
)


class BaseModel(Model):
    """A base model that will use our Sqlite database."""
    class Meta:
        database = dbhandle

class Person(BaseModel):
    name = CharField()
    birthday = DateField()


class Pet(BaseModel):
    owner = ForeignKeyField(Person, backref='pets')
    name = CharField()
    animal_type = CharField()




dbhandle.connect()

uncle_bob = Person(name='Bob', birthday=date(1960, 1, 15))
uncle_bob.save() # bob is now stored in the database
#dbhandle.create_tables([Person, Pet])
print("Test")
