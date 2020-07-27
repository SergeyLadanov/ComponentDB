var elementTypes = ["Все", "Конденсатор", "Резистор", "Катушка индуктивности", "Транзистор", "Микросхема", "Модуль", "Разъем", "Варистор", "Диод", "Светодиод", "Стабилитрон", "Переключатель", "Кварцевый резонатор", "Трансформатор", "Фотоэлемент", "Тиристор", "Блок питания", "Прочее"];
var changeNumber = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

function createTableToolBar()
{
    // Создание выпадающего списка
    var toolbar = document.createElement("div");
    var span = document.createElement("span");
    var select = document.createElement("select");

    select.id = "select-type";

    toolbar.className = "tableToolbar";
    span.className = "custom-dropdown big";
    toolbar.appendChild(span);
    span.appendChild(select);

    // Генерация списка типов элементов
    for (var i = 0; i < elementTypes.length; i++)
    {
        var option = document.createElement("option");
        option.innerHTML = elementTypes[i];
        select.appendChild(option);
    }

    // Создание кнопок
    var buttonAdd = document.createElement("a");
    buttonAdd.href = "#openModal";
    buttonAdd.id = "buttonAdd";
    buttonAdd.className = "buttonAdd";
    buttonAdd.innerHTML = "Доб.";

    toolbar.appendChild(buttonAdd);


    var buttonEdit = document.createElement("button");
    buttonEdit.id = "buttonEdit";
    buttonEdit.className = "buttonEdit";
    buttonEdit.innerHTML = "Ред.";

    toolbar.appendChild(buttonEdit);

    // Кнопка удалить
    var buttonRemove = document.createElement("button");
    buttonRemove.id = "buttonRemove";
    buttonRemove.className = "buttonRemove";
    buttonRemove.innerHTML = "Удал.";
    toolbar.appendChild(buttonRemove);



    // Кнопка удалить
    var buttonMinus = document.createElement("button");
    buttonMinus.href = "";
    buttonMinus.id = "buttonMinus";
    buttonMinus.className = "buttonMinus";
    buttonMinus.innerHTML = "Списать";
    toolbar.appendChild(buttonMinus);


    // Генерация списка чисел
    span = document.createElement("span");
    select = document.createElement("select");
    select.id = "changeNum";

    toolbar.className = "tableToolbar";
    span.className = "custom-dropdown big";
    toolbar.appendChild(span);
    span.appendChild(select);

    // Генерация списка типов элементов
    for (var i = 0; i < changeNumber.length; i++)
    {
        var option = document.createElement("option");
        option.innerHTML = changeNumber[i];
        select.appendChild(option);
    }

    span = document.createElement("span");
    span.innerHTML = "шт.       ";
    toolbar.appendChild(span);


    span = document.createElement("span");
    span.innerHTML = "Колич: ";
    span.className = "select-cnt";
    toolbar.appendChild(span);

    span = document.createElement("span");
    span.innerHTML = "";
    span.id = "secelctcnt";
    toolbar.appendChild(span);
  
    
    return toolbar;
}

// Функция для блокировки/разблокировки элементов тулбара
function enableToolbarElement(status)
{
    var buttonRemove = document.getElementById("buttonRemove");
    var buttonMinus =  document.getElementById("buttonMinus");
    var buttonEdit = document.getElementById("buttonEdit");
    if (status)
    {
        buttonMinus.classList.remove('buttonMinusDisabled');
        buttonRemove.classList.remove('buttonRemoveDisabled');
        buttonRemove.classList.add('buttonRemove');
        buttonMinus.classList.add("buttonMinus");
        buttonEdit.classList.add("buttonEdit");
        buttonEdit.classList.remove("buttonEditDisabled");

        $('#buttonRemove').attr('disabled', false);
        $('#buttonMinus').attr('disabled', false);
        $('#changeNum').attr('disabled', false);
        $('#buttonEdit').attr('disabled', false);
    }
    else
    {
        buttonRemove.classList.remove("buttonRemove");
        buttonMinus.classList.remove('buttonMinus');
        buttonMinus.classList.add('buttonMinusDisabled');
        buttonRemove.classList.add('buttonRemoveDisabled');
        buttonEdit.classList.remove("buttonEdit");
        buttonEdit.classList.add("buttonEditDisabled");


        $('#buttonRemove').attr('disabled', true);
        $('#buttonMinus').attr('disabled', true);
        $('#changeNum').attr('disabled', true);
        $('#buttonEdit').attr('disabled', true);
    }
}