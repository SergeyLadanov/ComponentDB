import peewee
from peewee import *
from datetime import date, datetime
import json
from config import DB_USER
from config import DB_PSWD
from config import DB_HOST
from config import DB_NAME

# Обработчик соединения к базе 
dbhandle = MySQLDatabase(
    DB_NAME, user=DB_USER,
    password=DB_PSWD,
    host=DB_HOST
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
            str(position.ChangeDate).split('.')[0]
            
            ])

    dbhandle.close()
    return array


# Проверка существования элемента в базе
# Необходимо вызвать dbhandle.connect() перед вызовом этой функции
def checkExisting(data):
    try:
        query = Component.select().where(
            (Component.Type == data["group"]) &
            (Component.ManufacturerPartNumber == data["name"]) &
            (Component.Value == data["value"]) &
            (Component.Units == data["unit"]) &
            (Component.Tolerance == data["tol"]) &
            (Component.Description == data["description"]) &
            (Component.Case == data["case"]) &
            (Component.Manufacturer == data["manufacturer"])
            ).get()
    except:
        query = None
    return query


# Добавление элемента в базу данных
def addPosition(data):
    status = "True"
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
        status = "Match"
    dbhandle.close()
    return status


# Функция удаления позиции
def removePosition(data):
    status = "True"
    dbhandle.connect()
    try:
        query = Component.select().where(Component.ID == data["id"]).get()
        query.delete_instance()
    except:
        status = "False"
    dbhandle.close()
    return status


# Функция редактирования позиции
def editPosition(data):
    status = "True"
    dbhandle.connect()
    result = checkExisting(data)
    date_time = datetime.now()

    try:
        if str(result.ID) == data["id"]:
            query = Component.select().where(Component.ID == data["id"]).get()
            status = str(date_time).split('.')[0]
        else:
            Component.select().where(Component.ID == data["id"]).get().delete_instance()
            data["cnt"] = str(int(result.Quantity) + int(data["cnt"]))
            query = result
            status = "Match"

        query.Type = data["group"] 
        query.ManufacturerPartNumber = data["name"] 
        query.Value = data["value"] 
        query.Units = data["unit"]
        query.Tolerance = data["tol"]
        query.Description = data["description"]
        query.Case = data["case"]
        query.Manufacturer = data["manufacturer"]
        query.Quantity = data["cnt"]
        query.CellNumber = data["cellnum"]
        query.ChangeDate = date_time
        query.save()
    except:
        status = "False"

    dbhandle.close()
    return status


# Проверка структуры БД
try:
    # Попытка считать данные
    dbhandle.connect()
    query = Component.select()
    for position in query:
        break
    dbhandle.close()
except:
    dbhandle.close()
    # Инициализация БД
    dbInit()

