var elementTypes = ["Все", "Конденсаторы", "Резисторы", "Транзисторы", "Катушки индуктивности", "Микросхемы", "Модули"];
var changeNumber = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];


function createTableToolBar()
{
    // Создание выпадающего списка
    var toolbar = document.createElement("div");
    var span = document.createElement("span");
    var select = document.createElement("select");

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
    var buttonRemove = document.createElement("a");
    buttonRemove.href = "";
    buttonRemove.className = "buttonRemove";
    buttonRemove.innerHTML = "Удалить позицию";
    toolbar.appendChild(buttonRemove);



    // Кнопка удалить
    var buttonMinus = document.createElement("a");
    buttonMinus.href = "";
    buttonMinus.className = "buttonMinus";
    buttonMinus.innerHTML = "Списать";
    toolbar.appendChild(buttonMinus);


    // Генерация списка чисел
    span = document.createElement("span");
    select = document.createElement("select");

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
    toolbar.appendChild(span);

    span = document.createElement("span");
    span.innerHTML = "";
    span.id = "secelctcnt";
    toolbar.appendChild(span);

    
   


    
    
    return toolbar;
}