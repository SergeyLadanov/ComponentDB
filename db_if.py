import peewee
from peewee import *
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
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


class Specification(BaseModel):
    ID = BigAutoField()
    Name = CharField(null=False)
    DeviceQuantity = BigIntegerField(null=False, default=1)
    SourceFile = CharField(null=False, default="")
    CreatedDate = DateTimeField(default=datetime.now)
    ChangeDate = DateTimeField(default=datetime.now)


class SpecificationItem(BaseModel):
    ID = BigAutoField()
    Specification = ForeignKeyField(
        Specification,
        backref="items",
        on_delete="CASCADE",
    )
    SourceRow = IntegerField(null=True)
    ComponentID = BigIntegerField(null=True)
    Type = CharField(null=False)
    ManufacturerPartNumber = CharField(null=True, default="")
    Value = CharField(null=True, default="")
    Units = CharField(null=True, default="")
    Tolerance = CharField(null=True, default="")
    Description = CharField(null=True, default="")
    Case = CharField(null=True, default="")
    Manufacturer = CharField(null=True, default="")
    QuantityPerDevice = BigIntegerField(null=False, default=1)


# Функция инициализации базы данных
def dbInit():
    dbhandle.connect()
    dbhandle.create_tables(
        [Component, ExpectedDelivery, ExpectedDeliveryItem, Specification, SpecificationItem],
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


def _component_snapshot(component):
    return {
        "group": component.Type,
        "name": component.ManufacturerPartNumber or "",
        "value": component.Value or "",
        "unit": component.Units or "",
        "tol": component.Tolerance or "",
        "description": component.Description or "",
        "case": component.Case or "",
        "manufacturer": component.Manufacturer or "",
    }


def _normalized_spec_value(key, value):
    text = " ".join(str(value or "").replace("\u00a0", " ").split()).casefold()
    if key == "value":
        try:
            return format(Decimal(text.replace(",", ".")).normalize(), "f")
        except InvalidOperation:
            return text
    if key == "tol":
        compact = text.replace(" ", "")
        number = compact[:-1] if compact.endswith("%") else compact
        try:
            normalized = format(Decimal(number.replace(",", ".")).normalize(), "f")
            return normalized + ("%" if compact.endswith("%") else "")
        except InvalidOperation:
            return compact
    if key == "unit":
        compact = text.replace(" ", "").replace("µ", "u").replace("μ", "u")
        aliases = {
            "pf": "пф", "nf": "нф", "uf": "мкф", "mf": "мф",
            "ohm": "ом", "kohm": "ком", "mohm": "мом",
            "uh": "мкгн", "nh": "нгн", "mh": "мгн", "h": "гн",
        }
        return aliases.get(compact, compact)
    return text


def _normalized_measure(value, unit):
    try:
        number = Decimal(str(value or "").strip().replace(",", "."))
    except InvalidOperation:
        return None
    raw_unit = str(unit or "").replace(" ", "").replace("µ", "u").replace("μ", "u")
    units = {
        "F": ("capacitance", "1"), "mF": ("capacitance", "1e-3"),
        "uF": ("capacitance", "1e-6"), "nF": ("capacitance", "1e-9"),
        "pF": ("capacitance", "1e-12"),
        "Ф": ("capacitance", "1"), "мФ": ("capacitance", "1e-3"),
        "мкФ": ("capacitance", "1e-6"), "нФ": ("capacitance", "1e-9"),
        "пФ": ("capacitance", "1e-12"),
        "Ohm": ("resistance", "1"), "kOhm": ("resistance", "1e3"),
        "MOhm": ("resistance", "1e6"), "Ом": ("resistance", "1"),
        "кОм": ("resistance", "1e3"), "МОм": ("resistance", "1e6"),
        "мОм": ("resistance", "1e-3"),
        "H": ("inductance", "1"), "mH": ("inductance", "1e-3"),
        "uH": ("inductance", "1e-6"), "nH": ("inductance", "1e-9"),
        "Гн": ("inductance", "1"), "мГн": ("inductance", "1e-3"),
        "мкГн": ("inductance", "1e-6"), "нГн": ("inductance", "1e-9"),
    }
    description = units.get(raw_unit)
    if description is None:
        insensitive = {
            "f": ("capacitance", "1"), "pf": ("capacitance", "1e-12"),
            "nf": ("capacitance", "1e-9"), "uf": ("capacitance", "1e-6"),
            "ohm": ("resistance", "1"), "kohm": ("resistance", "1e3"),
            "h": ("inductance", "1"), "uh": ("inductance", "1e-6"),
            "nh": ("inductance", "1e-9"),
        }
        description = insensitive.get(raw_unit.casefold())
    if description is None:
        return None
    dimension, multiplier = description
    return dimension, number * Decimal(multiplier)


def _specification_fields_match(component, data, filters):
    keys = {key for key, _field in filters}
    if "value" in keys and "unit" in keys:
        left = _normalized_measure(component.Value, component.Units)
        right = _normalized_measure(data["value"], data["unit"])
        if left is not None and right is not None:
            if left != right:
                return False
            filters = [(key, field) for key, field in filters if key not in ("value", "unit")]
    return all(
        _normalized_spec_value(key, getattr(component, field)) == _normalized_spec_value(key, data[key])
        for key, field in filters
    )


def _match_specification_item(data, components):
    component_id = data.get("componentId")
    if component_id is not None:
        return next((item for item in components if item.ID == int(component_id)), None)

    meaningful = lambda value: str(value or "").strip().casefold() not in ("", "-")
    keys = (
        ("group", "Type"), ("name", "ManufacturerPartNumber"),
        ("value", "Value"), ("unit", "Units"), ("tol", "Tolerance"),
        ("case", "Case"), ("manufacturer", "Manufacturer"),
    )
    filters = [(key, field) for key, field in keys if meaningful(data.get(key))]
    if not meaningful(data.get("group")) or not any(key in ("name", "value", "case") for key, _ in filters):
        return None
    matches = [
        component for component in components
        if _specification_fields_match(component, data, filters)
    ]
    if len(matches) == 1:
        return matches[0]
    passive_types = {"резистор", "конденсатор", "катушка индуктивности"}
    if (not matches and str(data.get("group") or "").strip().casefold() in passive_types
            and meaningful(data.get("value")) and meaningful(data.get("unit"))):
        parameter_keys = {"group", "value", "unit", "tol", "case"}
        parameter_filters = [(key, field) for key, field in filters if key in parameter_keys]
        matches = [
            component for component in components
            if _specification_fields_match(component, data, parameter_filters)
        ]
    return matches[0] if len(matches) == 1 else None


def _rematch_specification_items(items, components):
    """Attach old/unmatched BOM rows when a single current stock match exists."""
    component_list = list(components.values()) if isinstance(components, dict) else list(components)
    component_ids = {component.ID for component in component_list}
    for item in items:
        if item.ComponentID in component_ids:
            continue
        component = _match_specification_item({
            "componentId": None,
            "group": item.Type,
            "name": item.ManufacturerPartNumber or "",
            "value": item.Value or "",
            "unit": item.Units or "",
            "tol": item.Tolerance or "",
            "description": item.Description or "",
            "case": item.Case or "",
            "manufacturer": item.Manufacturer or "",
        }, component_list)
        if component is not None:
            SpecificationItem.update(ComponentID=component.ID).where(
                SpecificationItem.ID == item.ID
            ).execute()
            item.ComponentID = component.ID


def _spec_item_values(data, components):
    component = _match_specification_item(data, components)
    values = _component_snapshot(component) if component is not None else {
        key: str(data.get(key) or "")
        for key in ("group", "name", "value", "unit", "tol", "description", "case", "manufacturer")
    }
    return {
        "ComponentID": component.ID if component is not None else None,
        "Type": values["group"] or "Прочее",
        "ManufacturerPartNumber": values["name"],
        "Value": values["value"],
        "Units": values["unit"],
        "Tolerance": values["tol"],
        "Description": values["description"],
        "Case": values["case"],
        "Manufacturer": values["manufacturer"],
        "QuantityPerDevice": data["quantityPerDevice"],
    }


def getSpecifications():
    with dbhandle.connection_context():
        components = {item.ID: item for item in Component.select()}
        specifications = Specification.select().order_by(Specification.ChangeDate.desc(), Specification.ID.desc())
        result = []
        for specification in specifications:
            items = list(specification.items.order_by(SpecificationItem.ID))
            _rematch_specification_items(items, components)
            demand_by_component = {}
            for item in items:
                if item.ComponentID in components:
                    demand_by_component[item.ComponentID] = demand_by_component.get(item.ComponentID, 0) + item.QuantityPerDevice * specification.DeviceQuantity
            output_items = []
            for item in items:
                component = components.get(item.ComponentID)
                display = _component_snapshot(component) if component is not None else {
                    "group": item.Type, "name": item.ManufacturerPartNumber or "",
                    "value": item.Value or "", "unit": item.Units or "",
                    "tol": item.Tolerance or "", "description": item.Description or "",
                    "case": item.Case or "", "manufacturer": item.Manufacturer or "",
                }
                required = item.QuantityPerDevice * specification.DeviceQuantity
                total_required = demand_by_component.get(item.ComponentID, required)
                available = component.Quantity if component is not None else 0
                shortage = max(0, total_required - available)
                output_items.append({
                    "id": str(item.ID),
                    "sourceRow": item.SourceRow,
                    "componentId": str(component.ID) if component is not None else "",
                    "group": display["group"],
                    "name": display["name"],
                    "value": display["value"],
                    "unit": display["unit"],
                    "tol": display["tol"],
                    "description": display["description"],
                    "case": display["case"],
                    "manufacturer": display["manufacturer"],
                    "quantityPerDevice": str(item.QuantityPerDevice),
                    "requiredQuantity": str(required),
                    "totalRequiredQuantity": str(total_required),
                    "stockQuantity": str(available),
                    "shortageQuantity": str(shortage),
                    "status": "unmatched" if component is None else ("shortage" if shortage else "enough"),
                    "cellnum": component.CellNumber if component is not None else "",
                })
            order_rows = buildSpecificationOrderRows(specification, items, components, False)
            result.append({
                "id": str(specification.ID),
                "name": specification.Name,
                "deviceQuantity": str(specification.DeviceQuantity),
                "sourceFile": specification.SourceFile or "",
                "created": str(specification.CreatedDate).split('.')[0],
                "changed": str(specification.ChangeDate).split('.')[0],
                "items": output_items,
                "summary": {
                    "items": len(items),
                    "enough": sum(1 for item in output_items if item["status"] == "enough"),
                    "shortage": len(order_rows),
                    "required": sum(item.QuantityPerDevice * specification.DeviceQuantity for item in items),
                    "toOrder": sum(row["toOrder"] for row in order_rows),
                },
            })
        return result


def createSpecification(name, device_quantity, source_file="", items=None):
    with dbhandle.connection_context():
        with dbhandle.atomic():
            specification = Specification.create(
                Name=name, DeviceQuantity=device_quantity, SourceFile=source_file,
            )
            if items:
                components = list(Component.select())
                for item in items:
                    values = _spec_item_values(item, components)
                    SpecificationItem.create(
                        Specification=specification.ID,
                        SourceRow=item.get("sourceRow"),
                        **values,
                    )
            return str(specification.ID)


def updateSpecification(specification_id, name, device_quantity):
    with dbhandle.connection_context():
        changed = (Specification.update(
            Name=name, DeviceQuantity=device_quantity, ChangeDate=datetime.now(),
        ).where(Specification.ID == specification_id).execute())
        return changed == 1


def deleteSpecification(specification_id):
    with dbhandle.connection_context():
        with dbhandle.atomic():
            if Specification.get_or_none(Specification.ID == specification_id) is None:
                return False
            SpecificationItem.delete().where(
                SpecificationItem.Specification == specification_id
            ).execute()
            return Specification.delete().where(Specification.ID == specification_id).execute() == 1


def addSpecificationItem(specification_id, data):
    with dbhandle.connection_context():
        with dbhandle.atomic():
            specification = Specification.get_or_none(Specification.ID == specification_id)
            if specification is None:
                return None
            values = _spec_item_values(data, list(Component.select()))
            item = SpecificationItem.create(Specification=specification_id, **values)
            Specification.update(ChangeDate=datetime.now()).where(Specification.ID == specification_id).execute()
            return str(item.ID)


def addOrIncrementSpecificationItems(specification_id, component_ids):
    with dbhandle.connection_context():
        with dbhandle.atomic():
            specification = Specification.get_or_none(Specification.ID == specification_id)
            if specification is None:
                return None

            components = {
                component.ID: component
                for component in Component.select().where(Component.ID.in_(component_ids))
            }
            missing = [component_id for component_id in component_ids if component_id not in components]
            if missing:
                return {"added": 0, "incremented": 0, "missing": [str(item) for item in missing]}

            existing = {}
            for item in (SpecificationItem.select()
                         .where((SpecificationItem.Specification == specification_id) &
                                (SpecificationItem.ComponentID.in_(component_ids)))
                         .order_by(SpecificationItem.ID)):
                existing.setdefault(item.ComponentID, item)

            added = 0
            incremented = 0
            component_list = list(components.values())
            for component_id in component_ids:
                item = existing.get(component_id)
                if item is not None:
                    item.QuantityPerDevice += 1
                    item.save(only=[SpecificationItem.QuantityPerDevice])
                    incremented += 1
                    continue
                values = _spec_item_values({
                    "componentId": str(component_id),
                    "quantityPerDevice": 1,
                }, component_list)
                SpecificationItem.create(Specification=specification_id, **values)
                added += 1

            Specification.update(ChangeDate=datetime.now()).where(
                Specification.ID == specification_id
            ).execute()
            return {"added": added, "incremented": incremented, "missing": []}


def writeOffSpecification(specification_id):
    with dbhandle.connection_context():
        with dbhandle.atomic():
            specification = Specification.get_or_none(Specification.ID == specification_id)
            if specification is None:
                return None

            items = list(SpecificationItem.select().where(
                SpecificationItem.Specification == specification_id
            ).order_by(SpecificationItem.ID))
            components = {component.ID: component for component in Component.select()}
            unmatched = []
            requirements = {}
            for item in items:
                required = item.QuantityPerDevice * specification.DeviceQuantity
                component = components.get(item.ComponentID)
                if component is None:
                    unmatched.append({
                        "itemId": str(item.ID),
                        "name": item.ManufacturerPartNumber or item.Type,
                        "requiredQuantity": str(required),
                    })
                    continue
                requirement = requirements.setdefault(component.ID, {
                    "component": component,
                    "required": 0,
                })
                requirement["required"] += required

            insufficient = []
            written_off_positions = 0
            written_off_quantity = 0
            change_date = datetime.now()
            for component_id, requirement in requirements.items():
                component = requirement["component"]
                required = requirement["required"]
                quantity_to_write_off = min(component.Quantity, required)
                if component.Quantity < required:
                    insufficient.append({
                        "componentId": str(component_id),
                        "name": component.ManufacturerPartNumber or component.Type,
                        "requiredQuantity": str(required),
                        "stockQuantity": str(component.Quantity),
                    })
                if quantity_to_write_off == 0:
                    continue
                changed = (Component.update(
                    Quantity=Component.Quantity - quantity_to_write_off,
                    ChangeDate=change_date,
                ).where(
                    (Component.ID == component_id) & (Component.Quantity >= quantity_to_write_off)
                ).execute())
                if not changed:
                    current = Component.get_or_none(Component.ID == component_id)
                    insufficient.append({
                        "componentId": str(component_id),
                        "name": component.ManufacturerPartNumber or component.Type,
                        "requiredQuantity": str(required),
                        "stockQuantity": str(current.Quantity if current is not None else 0),
                    })
                    continue
                written_off_positions += 1
                written_off_quantity += quantity_to_write_off

            return {
                "writtenOffPositions": written_off_positions,
                "writtenOffQuantity": str(written_off_quantity),
                "unmatched": unmatched,
                "insufficient": insufficient,
            }


def updateSpecificationItem(specification_id, item_id, data):
    with dbhandle.connection_context():
        with dbhandle.atomic():
            values = _spec_item_values(data, list(Component.select()))
            changed = (SpecificationItem.update(**values).where(
                (SpecificationItem.ID == item_id) &
                (SpecificationItem.Specification == specification_id)
            ).execute())
            if changed:
                Specification.update(ChangeDate=datetime.now()).where(Specification.ID == specification_id).execute()
            return changed == 1


def deleteSpecificationItem(specification_id, item_id):
    with dbhandle.connection_context():
        with dbhandle.atomic():
            changed = (SpecificationItem.delete().where(
                (SpecificationItem.ID == item_id) &
                (SpecificationItem.Specification == specification_id)
            ).execute())
            if changed:
                Specification.update(ChangeDate=datetime.now()).where(Specification.ID == specification_id).execute()
            return changed == 1


def buildSpecificationOrderRows(specification, items, components, include_all=False):
    grouped = {}
    for item in items:
        component = components.get(item.ComponentID) if isinstance(components, dict) else None
        display = _component_snapshot(component) if component is not None else {
            "group": item.Type, "name": item.ManufacturerPartNumber or "",
            "value": item.Value or "", "unit": item.Units or "",
            "tol": item.Tolerance or "", "description": item.Description or "",
            "case": item.Case or "", "manufacturer": item.Manufacturer or "",
        }
        key = ("component", item.ComponentID) if component is not None else (
            "parameters", item.Type, item.ManufacturerPartNumber, item.Value,
            item.Units, item.Tolerance, item.Description, item.Case, item.Manufacturer,
        )
        row = grouped.setdefault(key, {
            "componentId": str(component.ID) if component is not None else "",
            "group": display["group"], "name": display["name"],
            "value": display["value"], "unit": display["unit"],
            "tol": display["tol"], "description": display["description"],
            "case": display["case"],
            "manufacturer": display["manufacturer"],
            "required": 0, "stock": component.Quantity if component is not None else 0,
            "cellnum": component.CellNumber if component is not None else "",
            "matched": component is not None,
        })
        row["required"] += item.QuantityPerDevice * specification.DeviceQuantity
    result = []
    for row in grouped.values():
        row["toOrder"] = max(0, row["required"] - row["stock"])
        if include_all or row["toOrder"] > 0:
            result.append(row)
    return result


def getSpecificationForExport(specification_id, include_all=False):
    with dbhandle.connection_context():
        specification = Specification.get_or_none(Specification.ID == specification_id)
        if specification is None:
            return None
        items = list(specification.items.order_by(SpecificationItem.ID))
        components = {item.ID: item for item in Component.select()}
        _rematch_specification_items(items, components)
        return specification, buildSpecificationOrderRows(specification, items, components, include_all)


def createExpectedDeliveryFromSpecification(specification_id):
    with dbhandle.connection_context():
        with dbhandle.atomic():
            specification = Specification.get_or_none(Specification.ID == specification_id)
            if specification is None:
                return None
            items = list(specification.items.order_by(SpecificationItem.ID))
            components = {item.ID: item for item in Component.select()}
            _rematch_specification_items(items, components)
            order_rows = buildSpecificationOrderRows(
                specification, items, components, include_all=False,
            )
            if not order_rows:
                return {"id": "", "items": 0}
            delivery_items = [
                {
                    "sourceRow": source_row,
                    "group": row["group"],
                    "name": row["name"],
                    "value": row["value"],
                    "unit": row["unit"],
                    "tol": row["tol"],
                    "description": row["description"],
                    "case": row["case"],
                    "manufacturer": row["manufacturer"],
                    "cnt": row["toOrder"],
                    "cellnum": row["cellnum"],
                }
                for source_row, row in enumerate(order_rows, start=1)
            ]
            name = f'Дозаказ — {specification.Name}'[:255]
            delivery_id = _createExpectedDelivery(
                name,
                f'Спецификация #{specification.ID}',
                delivery_items,
            )
            return {"id": delivery_id, "items": len(delivery_items), "name": name}

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
        [Component, ExpectedDelivery, ExpectedDeliveryItem, Specification, SpecificationItem],
        safe=True,
    )
    dbhandle.close()
except:
    if not dbhandle.is_closed():
        dbhandle.close()
    dbInit()

