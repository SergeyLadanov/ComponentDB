import peewee
from peewee import *
from datetime import date, datetime
import json

 
user = 'root'
password = '12345678'
db_name = 'test'

# Обработчик соединения к базе 
dbhandle = MySQLDatabase(
    db_name, user=user,
    password=password,
    host='localhost'
)

# Базовая модель
class BaseModel(Model):
    """A base model that will use our Sqlite database."""
    class Meta:
        database = dbhandle
# Структура базы
class Component(BaseModel):
    ID = BigAutoField()
    Type = CharField(null = False)
    ManufacturerPartNumber = CharField(null = True, default="-")
    Value = CharField(null = True, default="")
    Units = CharField(null = True, default="")
    Tolerance = CharField(null = True, default="-")
    Description = CharField(null = True, default="-")
    Case = CharField(null = True, default="-")
    Manufacturer = CharField(null = True, default="-")
    Quantity = BigIntegerField(null = False, default=1)
    CellNumber = CharField(null = False)
    ChangeDate = DateTimeField(default=datetime.now)


# Функция инициализации базы данных
def dbInit():
    dbhandle.connect()
    dbhandle.create_tables([Component])
    dbhandle.close()

# Функция отправки данных из базы
def getData(filter):
    dbhandle.connect()
    array = {'data': [ ]}
    
    if filter == "":
        query = Component.select()
    else:
        query = Component.select().where(Component.Type == filter)

    for position in query:
        array["data"].append([
            position.ID, 
            position.Type, 
            position.ManufacturerPartNumber, 
            position.Value, 
            position.Units,  
            position.Tolerance,
            position.Description,
            position.Case,
            position.Manufacturer,
            position.Quantity,
            position.CellNumber,
            position.ChangeDate
            
            ])

    dbhandle.close()
    return array


# Проверка существования элемента в базе
# Необходимо вызвать dbhandle.connect() перед вызовом этой функции
def checkExisting(data):
    try:
        query = Component.select().where(
            Component.Type == data["group"] and
            Component.ManufacturerPartNumber == data["name"] and
            Component.Value == data["value"] and
            Component.Units == data["unit"] and
            Component.Tolerance == data["tol"] and
            Component.Description == data["description"] and
            Component.Case == data["case"] and
            Component.Manufacturer == data["manufacturer"]
            ).get()
    except:
        query = None
    return query


# Добавление элемента в базу данных
def addPosition(data):
    dbhandle.connect()
    result = checkExisting(data)
    if result  is None:
        component = Component(
            Type = data["group"], 
            ManufacturerPartNumber = data["name"], 
            Value = data["value"],
            Units = data["unit"],
            Tolerance = data["tol"],
            Description = data["description"],
            Case = data["case"],
            Manufacturer = data["manufacturer"],
            Quantity = data["cnt"],
            CellNumber = data["cellnum"],
        )
        component.save()
    else:
        result.Quantity = result.Quantity + int(data["cnt"])
        result.ChangeDate = datetime.now()
        result.save()
    dbhandle.close()


def removePosition(data):
    dbhandle.connect()
    try:
        query = Component.select().where(Component.ID == data["id"]).get()
        query.delete_instance()
    except:
        print("Component was not found!")
    dbhandle.close()

def editPosition(data):
    test = 0

def subPosition(data):
    test = 0



#dbInit()
#uncle_bob = Person(name='Ваня', birthday=date(1960, 1, 15))
#uncle_bob.save() # bob is now stored in the database


#uncle_bob = Person(name='Bob', birthday=date(1960, 1, 15))
#uncle_bob.save() # bob is now stored in the database
#grandma = Person.create(name='Grandma', birthday=date(1935, 3, 1))
#herb = Person.create(name='Herb', birthday=date(1950, 5, 5))

#grandma.name = 'Grandma L.'
#grandma.save()  # Update grandma's name in the database.

#bob_kitty = Pet.create(owner=uncle_bob, name='Kitty', animal_type='cat')
#herb_fido = Pet.create(owner=herb, name='Fido', animal_type='dog')
#herb_mittens = Pet.create(owner=herb, name='Mittens', animal_type='cat')
#herb_mittens_jr = Pet.create(owner=herb, name='Mittens Jr', animal_type='cat')

#herb_mittens.delete_instance() # he had a great life

#herb_fido.owner = uncle_bob
#herb_fido.save()
#query = Pet.select().where(Pet.animal_type == 'cat', Pet.name == 'Kitty')
#for pet in query:
#    print(pet.name, pet.owner.name)


print("Test")

