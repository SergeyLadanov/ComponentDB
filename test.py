import pymysql
from pymysql.cursors import DictCursor
connection = pymysql.connect(
    host='localhost',
    user='root',
    password='12345678',
    db='Components',
    charset='utf8mb4',
    cursorclass=DictCursor
)

with connection.cursor() as cursor:
    copmonnet = [
            'Конденсатор',
            'NameOfManufacturer',
            '0.01',
            '10',
            '0603',
            '1.0'
        ]
    query = "INSERT INTO compdescription (`ComponentType`, `ManufacturerPartNumber`, `Value`, `Power/Voltage`, `Case`, `Tolerance`) VALUES (%s, %s, %s, %s, %s, %s)"
    cursor.execute(query, ('Конденсатор', 'NameOfManufacturer', '0.01', '10.0', '0603', '1.0'))
    connection.commit()

with connection.cursor() as cursor:
    query = 'SELECT `ComponentType`, `ManufacturerPartNumber`, `Value`, `Power/Voltage`, `Case`, `Tolerance` FROM compdescription'
    cursor.execute(query)
    for row in cursor:
        print(row['ComponentType'], row['ManufacturerPartNumber'], row['Value'], row['Power/Voltage'], row['Case'])

#...
connection.close()