var elementTypes = ["Все", "Конденсатор", "Резистор", "Катушка индуктивности", "Транзистор", "Микросхема", "Модуль", "Разъем", "Варистор", "Диод", "Светодиод", "Стабилитрон"];
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
    buttonAdd.className = "buttonAdd";
    buttonAdd.innerHTML = "Добавить позицию";

    toolbar.appendChild(buttonAdd);

    // Кнопка удалить
    var buttonRemove = document.createElement("button");
    buttonRemove.id = "buttonRemove";
    buttonRemove.className = "buttonRemove";
    buttonRemove.innerHTML = "Удалить позицию";
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
    if (status)
    {
        buttonMinus.classList.remove('buttonMinusDisabled');
        buttonRemove.classList.remove('buttonRemoveDisabled');
        buttonRemove.classList.add('buttonRemove');
        buttonMinus.classList.add("buttonMinus");

        $('#buttonRemove').attr('disabled', false);
        $('#buttonMinus').attr('disabled', false);
        $('#changeNum').attr('disabled', false);
    }
    else
    {
        buttonRemove.classList.remove("buttonRemove");
        buttonMinus.classList.remove('buttonMinus');
        buttonMinus.classList.add('buttonMinusDisabled');
        buttonRemove.classList.add('buttonRemoveDisabled');


        $('#buttonRemove').attr('disabled', true);
        $('#buttonMinus').attr('disabled', true);
        $('#changeNum').attr('disabled', true);
    }
}