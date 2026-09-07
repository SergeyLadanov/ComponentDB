import peewee
from peewee import *
from datetime import date, datetime
import json
from config import DB_USER
from config import DB_PSWD
from config import DB_HOST
from config import DB_NAME
from config import DB_PORT

# Обработчик соединения к базе 
dbhandle = MySQLDatabase(
    DB_NAME, user=DB_USER,
    password=DB_PSWD,
    host=DB_HOST,
    port=DB_PORT
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


class ExpectedDelivery(BaseModel):
    ID = BigAutoField()
    Name = CharField(null=False)
    SourceFile = CharField(null=False)
    Status = CharField(null=False, default="pending")
    CreatedDate = DateTimeField(default=datetime.now)
    ConfirmedDate = DateTimeField(null=True)


class ExpectedDeliveryItem(BaseModel):
    ID = BigAutoField()
    Delivery = ForeignKeyField(
        ExpectedDelivery,
        backref="items",
        on_delete="CASCADE",
    )
    SourceRow = IntegerField(null=False)
    Type = CharField(null=False)
    ManufacturerPartNumber = CharField(null=True, default="")
    Value = CharField(null=True, default="")
    Units = CharField(null=True, default="")
    Tolerance = CharField(null=True, default="")
    Description = CharField(null=True, default="")
    Case = CharField(null=True, default="")
    Manufacturer = CharField(null=True, default="")
    Quantity = BigIntegerField(null=False)
    CellNumber = CharField(null=False, default="")


# Функция инициализации базы данных
def dbInit():
    dbhandle.connect()
    dbhandle.create_tables(
        [Component, ExpectedDelivery, ExpectedDeliveryItem],
        safe=True,
    )
    dbhandle.close()


def _item_dict(item):
    return {
        "id": str(item.ID),
        "sourceRow": item.SourceRow,
        "group": item.Type,
        "name": item.ManufacturerPartNumber or "",
        "value": item.Value or "",
        "unit": item.Units or "",
        "tol": item.Tolerance or "",
        "description": item.Description or "",
        "case": item.Case or "",
        "manufacturer": item.Manufacturer or "",
        "cnt": str(item.Quantity),
        "cellnum": item.CellNumber or "",
    }


def getExpectedDeliveries():
    with dbhandle.connection_context():
        deliveries = (
            ExpectedDelivery.select()
            .where(ExpectedDelivery.Status == "pending")
            .order_by(ExpectedDelivery.CreatedDate.desc(), ExpectedDelivery.ID.desc())
        )
        return [
            {
                "id": str(delivery.ID),
                "name": delivery.Name,
                "sourceFile": delivery.SourceFile,
                "created": str(delivery.CreatedDate).split('.')[0],
                "items": [
                    _item_dict(item)
                    for item in delivery.items.order_by(
                        ExpectedDeliveryItem.SourceRow,
                        ExpectedDeliveryItem.ID,
                    )
                ],
            }
            for delivery in deliveries
        ]


def createExpectedDelivery(name, source_file, items):
    with dbhandle.connection_context():
        return _createExpectedDelivery(name, source_file, items)


def _createExpectedDelivery(name, source_file, items):
    with dbhandle.atomic():
        delivery = ExpectedDelivery.create(Name=name, SourceFile=source_file)
        rows = [
            {
                "Delivery": delivery.ID,
                "SourceRow": item["sourceRow"],
                "Type": item["group"],
                "ManufacturerPartNumber": item["name"],
                "Value": item["value"],
                "Units": item["unit"],
                "Tolerance": item["tol"],
                "Description": item["description"],
                "Case": item["case"],
                "Manufacturer": item["manufacturer"],
                "Quantity": item["cnt"],
                "CellNumber": item["cellnum"],
            }
            for item in items
        ]
        # Небольшие пакеты не упираются в лимит параметров SQLite в тестах
        # и в max_allowed_packet на рабочих MySQL с большими отчетами.
        for offset in range(0, len(rows), 75):
            ExpectedDeliveryItem.insert_many(rows[offset:offset + 75]).execute()
        return str(delivery.ID)


def updateExpectedDeliveryItem(delivery_id, item_id, data):
    with dbhandle.connection_context():
        return _updateExpectedDeliveryItem(delivery_id, item_id, data)


def _updateExpectedDeliveryItem(delivery_id, item_id, data):
    with dbhandle.atomic():
        changed = (
            ExpectedDeliveryItem.update(
                Type=data["group"],
                ManufacturerPartNumber=data["name"],
                Value=data["value"],
                Units=data["unit"],
                Tolerance=data["tol"],
                Description=data["description"],
                Case=data["case"],
                Manufacturer=data["manufacturer"],
                Quantity=data["cnt"],
                CellNumber=data["cellnum"],
            )
            .where(
                (ExpectedDeliveryItem.ID == item_id)
                & (ExpectedDeliveryItem.Delivery == delivery_id)
                & (ExpectedDeliveryItem.Delivery.in_(
                    ExpectedDelivery.select(ExpectedDelivery.ID).where(
                        ExpectedDelivery.Status == "pending"
                    )
                ))
            )
            .execute()
        )
        return changed == 1


def updateExpectedDeliveryItems(delivery_id, items):
    with dbhandle.connection_context():
        with dbhandle.atomic():
            delivery = ExpectedDelivery.get_or_none(
                (ExpectedDelivery.ID == delivery_id)
                & (ExpectedDelivery.Status == "pending")
            )
            if delivery is None:
                return False
            for item in items:
                changed = (
                    ExpectedDeliveryItem.update(
                        Type=item["group"],
                        ManufacturerPartNumber=item["name"],
                        Value=item["value"],
                        Units=item["unit"],
                        Tolerance=item["tol"],
                        Description=item["description"],
                        Case=item["case"],
                        Manufacturer=item["manufacturer"],
                        Quantity=item["cnt"],
                        CellNumber=item["cellnum"],
                    )
                    .where(
                        (ExpectedDeliveryItem.ID == item["id"])
                        & (ExpectedDeliveryItem.Delivery == delivery_id)
                    )
                    .execute()
                )
                if changed != 1:
                    raise ValueError("Одна из позиций поставки уже удалена.")
            return True


def deleteExpectedDeliveryItem(delivery_id, item_id):
    with dbhandle.connection_context():
        with dbhandle.atomic():
            changed = (
                ExpectedDeliveryItem.delete()
                .where(
                    (ExpectedDeliveryItem.ID == item_id)
                    & (ExpectedDeliveryItem.Delivery == delivery_id)
                    & (ExpectedDeliveryItem.Delivery.in_(
                        ExpectedDelivery.select(ExpectedDelivery.ID).where(
                            ExpectedDelivery.Status == "pending"
                        )
                    ))
                )
                .execute()
            )
            return changed == 1


def cancelExpectedDelivery(delivery_id):
    with dbhandle.connection_context():
        return _cancelExpectedDelivery(delivery_id)


def _cancelExpectedDelivery(delivery_id):
    with dbhandle.atomic():
        changed = (
            ExpectedDelivery.update(Status="cancelled")
            .where(
                (ExpectedDelivery.ID == delivery_id)
                & (ExpectedDelivery.Status == "pending")
            )
            .execute()
        )
        return changed == 1


def confirmExpectedDelivery(delivery_id):
    with dbhandle.connection_context():
        return _confirmExpectedDelivery(delivery_id)


def _confirmExpectedDelivery(delivery_id):
    """Apply a pending delivery to stock exactly once in one transaction."""
    with dbhandle.atomic():
        claimed = (
            ExpectedDelivery.update(Status="confirming")
            .where(
                (ExpectedDelivery.ID == delivery_id)
                & (ExpectedDelivery.Status == "pending")
            )
            .execute()
        )
        if claimed != 1:
            return None

        items = list(
            ExpectedDeliveryItem.select()
            .where(ExpectedDeliveryItem.Delivery == delivery_id)
            .order_by(ExpectedDeliveryItem.ID)
        )
        if not items:
            raise ValueError("В поставке нет позиций.")
        created = 0
        merged = 0
        now = datetime.now()
        for item in items:
            data = {
                "group": item.Type,
                "name": item.ManufacturerPartNumber or "",
                "value": item.Value or "",
                "unit": item.Units or "",
                "tol": item.Tolerance or "",
                "description": item.Description or "",
                "case": item.Case or "",
                "manufacturer": item.Manufacturer or "",
            }
            existing = checkExisting(data)
            if existing is None:
                Component.create(
                    Type=data["group"],
                    ManufacturerPartNumber=data["name"],
                    Value=data["value"],
                    Units=data["unit"],
                    Tolerance=data["tol"],
                    Description=data["description"],
                    Case=data["case"],
                    Manufacturer=data["manufacturer"],
                    Quantity=item.Quantity,
                    CellNumber=item.CellNumber,
                    ChangeDate=now,
                )
                created += 1
            else:
                existing.Quantity += item.Quantity
                if not (existing.CellNumber or "").strip():
                    existing.CellNumber = item.CellNumber
                existing.ChangeDate = now
                existing.save()
                merged += 1

        ExpectedDelivery.update(
            Status="confirmed",
            ConfirmedDate=now,
        ).where(ExpectedDelivery.ID == delivery_id).execute()
        return {"created": created, "merged": merged, "items": len(items)}

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
    return Component.get_or_none(
            (Component.Type == data["group"]) &
            (Component.ManufacturerPartNumber == data["name"]) &
            (Component.Value == data["value"]) &
            (Component.Units == data["unit"]) &
            (Component.Tolerance == data["tol"]) &
            (Component.Description == data["description"]) &
            (Component.Case == data["case"]) &
            (Component.Manufacturer == data["manufacturer"])
    )


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
    # Флаг изменения текущей позиции
    changeCurrent = True

    try:
        if result is None:
            changeCurrent = True
        else:
            if str(result.ID) == data["id"]:
               changeCurrent = True 
            else:
                changeCurrent = False

        if changeCurrent:
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
    dbhandle.connect()
    dbhandle.create_tables(
        [Component, ExpectedDelivery, ExpectedDeliveryItem],
        safe=True,
    )
    dbhandle.close()
except:
    if not dbhandle.is_closed():
        dbhandle.close()
    dbInit()

