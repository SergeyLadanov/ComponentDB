# ComponentDB

Веб-приложение для учета электронных компонентов: Flask + MySQL/Peewee и React + TypeScript + Webpack.
Интерфейс перенесен на основу **FlaskReactTemplate**: каталог `react`, точка входа `src/ts/index.tsx`, React-компоненты, Bootstrap 5, SCSS и сборка Webpack, которую раздает Flask.

## Возможности

- Все 12 полей существующей базы, сортировка, общий поиск и поиск в каждом столбце.
- Общий поиск распознает номинал с единицей: `1 кОм`, `1кОм` и `1,0 кОм` находят значение 1 в кОм, без совпадений по ID, количеству или дате. Можно добавлять другие условия: `резистор 1 кОм 0603`. Поддерживаются единицы из формы и сохраненных позиций; пересчет между единицами не выполняется.
- Фильтр по классификации и страницы по 25, 50 или 100 записей.
- Совпадения общего поиска и фильтров столбцов подсвечиваются в таблице. Для номинала выделяются значение и единица измерения; подсветка адаптируется к светлой и темной теме.
- Добавление, редактирование, удаление с подтверждением и списание от 1 до 10 штук. Остаток не становится отрицательным.
- Добавление по образцу: выберите строку и нажмите «Добавить позицию». Количество новой партии по умолчанию равно 1.
- При совпадении характеристик сервер объединяет позиции и суммирует количество, как в прежней версии.
- Светлая, темная и системная темы; адаптивная страница и горизонтальная прокрутка таблицы.
- Состояния загрузки, сообщения об ошибках и повторная загрузка. Форма сохраняет введенные данные при неудачной отправке.
- Отдельная страница входа `/login`, сессия на 12 часов и выход из учетной записи через шапку приложения.

Схема MySQL, учетные записи `ACCOUNTS` в `config.py` и адреса `/get_data` и `/request_handler` сохранены. Для существующих клиентов API поддерживается Basic Auth. Перенос данных не требуется. Исходный проект FlaskReactTemplate не изменяется.

## Установка

Требуются Python, MySQL и Node.js 20+ с npm. Node.js нужен для сборки и разработки интерфейса; при обычном запуске готовую сборку раздает Python.

Установите зависимости Python в виртуальное окружение:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

На Linux окружение активируется командой `source .venv/bin/activate`.

Соберите интерфейс из корня проекта:

```text
cd react
npm ci
npm run build
cd ..
```

Результат появится в `static/dist/`. Этот каталог и `react/node_modules/` не хранятся в Git. После изменения исходников React сборку нужно повторить.

## Настройка MySQL

Создайте базу и пользователя, например в консоли MySQL:

```sql
CREATE DATABASE componentdb CHARACTER SET utf8mb4;
CREATE USER 'componentdb'@'localhost' IDENTIFIED BY 'replace-this-password';
GRANT ALL PRIVILEGES ON componentdb.* TO 'componentdb'@'localhost';
```

Первый вызов `python run.py` при отсутствии `config.py` создает файл настроек и завершает работу. Заполните его перед следующим запуском:

```python
HTTP_HOST = "127.0.0.1"
HTTP_PORT = 5000
ACCOUNTS = ["user:replace-this-password"]

DB_HOST = "localhost"
DB_PORT = 3306
DB_USER = "componentdb"
DB_NAME = "componentdb"
DB_PSWD = "replace-this-password"

RELATIVE_PATH = True
DUMP_PATH = "/dump/dump.sql"
```

При первом подключении приложение создает таблицу компонентов, если ее еще нет. Существующий `config.py` и база используются без изменений.

## Запуск

Из корня проекта с активным окружением Python:

```text
python run.py
```

Откройте `http://127.0.0.1:5000` (или адрес из `config.py`): приложение перенаправит на `/login`. Введите учетные данные из `ACCOUNTS`. После входа откроется база компонентов, а в шапке появятся логин и кнопка «Выйти». При истечении сессии приложение снова откроет страницу входа. `run.py` запускает WSGI-сервер Cheroot. `web.py` запускает встроенный сервер Flask для разработки. Существующий `service.py` остается точкой запуска службы Windows; для него дополнительно нужны `pywin32` и `waitress`.

Сессия хранится в подписанной cookie с `HttpOnly` и `SameSite=Lax`, без пароля. Вход, выход и изменения данных через сессию защищены CSRF-токеном. API возвращает `401` без вызова стандартного окна авторизации браузера.

По умолчанию ключ подписи генерируется при запуске сервера: после перезапуска потребуется войти снова. Чтобы сохранять сессии при перезапуске или использовать несколько процессов, задайте одинаковый постоянный случайный секрет в переменной окружения `COMPONENTDB_SECRET_KEY` для всех процессов. Секрет можно сгенерировать командой `python -c "import secrets; print(secrets.token_hex(32))"`. При работе через HTTPS задайте `COMPONENTDB_COOKIE_SECURE=1`. В Docker передайте эти переменные в окружение контейнера приложения.

## Разработка интерфейса

В первом терминале запустите Flask с доступной MySQL:

```text
python web.py
```

Во втором терминале:

```text
cd react
npm start
```

Откройте `http://127.0.0.1:8080`. Webpack обслуживает сборку из памяти с горячим обновлением, а главную страницу, `/login`, `/logout`, `/auth/session` и API проксирует во Flask. Поэтому вход и сессии работают и на порту 8080; отдельный CORS не требуется.

По умолчанию Flask ожидается на `http://127.0.0.1:5000`. Для другого порта задайте `FLASK_URL` перед `npm start`:

```powershell
$env:FLASK_URL = "http://127.0.0.1:5123"
npm start
```

В Bash: `FLASK_URL=http://127.0.0.1:5123 npm start`.

Альтернативный режим — `npm run watch`: Webpack обновляет файлы на диске в `static/dist/`, страницу следует открывать на порту Flask и обновлять вручную.

## Docker

Dockerfile собирает React в отдельном этапе Node.js и копирует `static/dist` в Python-образ. Предварительная локальная сборка и Node.js на хосте не нужны.

До запуска создайте обычный файл `config.py` с настройками для текущего `docker-compose.yml`:

```python
HTTP_HOST = "0.0.0.0"
HTTP_PORT = 5123
ACCOUNTS = ["user:replace-this-password"]
DB_HOST = "components_db"
DB_PORT = 3306
DB_USER = "comp_db"
DB_NAME = "comp_db"
DB_PSWD = "comp_db"
RELATIVE_PATH = True
DUMP_PATH = "/dump/dump.sql"
```

Пароли MySQL должны соответствовать настройкам сервиса `components_db` в Compose. Затем выполните:

```text
docker compose up --build -d
```

Приложение доступно на `http://localhost:5123`. Конфигурация, дампы и каталог MySQL подключаются через тома; `.dockerignore` исключает их из контекста сборки образа.

### Reverse proxy в подкаталоге

Приложение может работать под произвольным URL-префиксом, например `/components/`.
Nginx должен удалить префикс при передаче запроса приложению и сообщить Flask исходный
префикс заголовком `X-Forwarded-Prefix`:

```nginx
location = /components {
    return 301 /components/;
}

location /components/ {
    proxy_pass http://127.0.0.1:5123/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Prefix /components;
}
```

Для другого пути замените `/components` в обеих директивах `location`, в `return`
и в `X-Forwarded-Prefix`. Завершающий `/` у `proxy_pass` важен: он удаляет внешний
префикс перед отправкой маршрута во Flask.

## Проверки

Проверка типов, регрессионные тесты поиска и production-сборка:

```text
cd react
npm test
cd ..
```

Проверка настоящих Flask-маршрутов и Peewee-модели на временной SQLite-базе:

```text
python -m unittest discover -s tests -v
```

Тесты подставляют конфигурацию только на время импорта, не читают рабочий `config.py` и не подключаются к MySQL. Проверяются авторизация, формат данных, фильтры, операции с позициями, объединение дубликатов и отклонение некорректных данных.

Для ручной проверки интерфейса без MySQL сначала выполните `npm run build` в `react`, затем из корня:

```text
python -m tests.preview_server
```

Тестовая страница: `http://127.0.0.1:5055`, логин `tester`, пароль `testing`. Сервер создает 66 демонстрационных позиций во временной базе; данные предназначены только для проверки. Для проверки Webpack с этим сервером задайте `FLASK_URL=http://127.0.0.1:5055`.

## Резервные копии и служба Linux

Для резервного копирования установите клиент MySQL/MariaDB и выполните `python dump.py`. Путь задается через `DUMP_PATH`; при `RELATIVE_PATH = True` он отсчитывается от каталога проекта. В Docker:

```text
docker compose run --rm components_app python3 dump.py
```

Пример `/etc/systemd/system/components.service` (замените пути на свои):

```ini
[Unit]
Description=ComponentDB
After=network.target

[Service]
WorkingDirectory=/opt/ComponentDB
ExecStart=/opt/ComponentDB/.venv/bin/python /opt/ComponentDB/run.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

После сборки интерфейса и настройки `config.py`: `systemctl daemon-reload` и `systemctl enable --now components`.
