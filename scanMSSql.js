const sql = require('mssql');

async () => {
    try {

    } catch (err) {
        // ... error checks
    }
    // make sure that any items are correctly URL encoded in the connection string
    await sql.connect('Server=39.100.163.70,1433;Database=database;User Id=username;Password=password;Encrypt=true')
    const result = await sql.query`select * from mytable where id = ${value}`
    console.dir(result)
}