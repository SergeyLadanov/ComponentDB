"""Import a device specification from a regular or PCB BOM Parser workbook."""
from pathlib import Path
from zipfile import BadZipFile

from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException

from delivery_import import (
    _limited, _meaningful, _number_text, _parse_parameters, _parse_quantity,
    _text, _translate_unit, TYPE_ALIASES,
)


class SpecificationImportError(ValueError):
    pass


HEADER_ALIASES = {
    "id компонента": "component_id",
    "id позиции": "component_id",
    "component id": "component_id",
    "классификация": "group",
    "тип": "group",
    "тип элемента": "group",
    "наименование": "name",
    "артикул": "name",
    "наимен. произв.": "name",
    "manufacturer part number": "name",
    "исходное наименование": "source_name",
    "значение": "value",
    "ед. изм.": "unit",
    "единица": "unit",
    "точность": "tol",
    "описание": "description",
    "корпус": "case",
    "производитель": "manufacturer",
    "параметры": "parameters",
    "количество": "quantity",
    "количество на устройство": "quantity",
    "кол-во на устройство": "quantity",
    "qty": "quantity",
}


def parse_specification_workbook(file_stream, filename):
    if Path(filename or "").suffix.lower() != ".xlsx":
        raise SpecificationImportError("Выберите спецификацию в формате .xlsx.")
    try:
        workbook = load_workbook(file_stream, read_only=True, data_only=True)
    except (InvalidFileException, BadZipFile, OSError, ValueError, KeyError):
        raise SpecificationImportError("Не удалось прочитать файл Excel.") from None

    try:
        rows = workbook.active.iter_rows(values_only=True)
        header = next(rows, None)
        if not header:
            raise SpecificationImportError("В файле нет строки заголовков.")
        columns = {}
        for index, value in enumerate(header):
            key = HEADER_ALIASES.get(_text(value).lower())
            if key and key not in columns:
                columns[key] = index
        if "quantity" not in columns:
            raise SpecificationImportError(
                "В файле должен быть столбец «Количество на устройство» или «Количество»."
            )
        if not any(key in columns for key in ("component_id", "name", "source_name", "parameters")):
            raise SpecificationImportError(
                "Добавьте ID компонента, наименование или параметры позиции."
            )

        result = []
        for row_number, row in enumerate(rows, start=2):
            def cell(key):
                index = columns.get(key)
                return row[index] if index is not None and index < len(row) else None

            if all(cell(key) in (None, "") for key in columns):
                continue
            if len(result) >= 5000:
                raise SpecificationImportError("В одной спецификации может быть не более 5000 позиций.")
            try:
                quantity = _parse_quantity(cell("quantity"), row_number)
            except ValueError as error:
                raise SpecificationImportError(str(error)) from None

            component_id = _text(cell("component_id"))
            if component_id and (not component_id.isascii() or not component_id.isdigit() or int(component_id) <= 0):
                raise SpecificationImportError(f"Строка {row_number}: некорректный ID компонента.")
            parameters = _parse_parameters(cell("parameters"))
            source_name = _meaningful(cell("source_name"))
            name = _meaningful(cell("name")) or source_name
            group = TYPE_ALIASES.get(_meaningful(cell("group")) or "Прочее", _meaningful(cell("group")) or "Прочее")
            value = _meaningful(cell("value")) or parameters["value"]
            unit = _translate_unit(_meaningful(cell("unit"))) if _meaningful(cell("unit")) else parameters["unit"]
            tol = _meaningful(cell("tol")) or parameters["tol"]
            case = _meaningful(cell("case")) or parameters["case"]
            if not component_id and not any((name, value, case)):
                raise SpecificationImportError(f"Строка {row_number}: недостаточно данных для сопоставления позиции.")
            item = {
                "sourceRow": row_number,
                "componentId": int(component_id) if component_id else None,
                "group": _limited(group, row_number, "Классификация"),
                "name": _limited(name, row_number, "Наименование"),
                "value": _limited(_number_text(value) if value else "", row_number, "Значение"),
                "unit": _limited(unit, row_number, "Единицы измерения"),
                "tol": _limited(tol, row_number, "Точность"),
                "description": _limited(_meaningful(cell("description")), row_number, "Описание"),
                "case": _limited(case, row_number, "Корпус"),
                "manufacturer": _limited(_meaningful(cell("manufacturer")), row_number, "Производитель"),
                "quantityPerDevice": quantity,
            }
            result.append(item)
        if not result:
            raise SpecificationImportError("В файле нет позиций спецификации.")
        return result
    finally:
        workbook.close()
