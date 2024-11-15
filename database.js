const express = require('express');
const { createPool } = require('mysql');

const app = express();
const PORT = 3000;

// Parse JSON bodies
app.use(express.json());

const pool = createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'laravel',
    connectionLimit: 10,
});

// const pool = createPool({
//     host: 'sql12.freemysqlhosting.net',
//     port: 3306,
//     user: 'sql12744971',
//     password: 'ptb3yFkxd7',
//     database: 'sql12744971',
// });

// List of allowed tables to avoid SQL injection
const allowedTables = ['users', 'posts', 'comments']; // Add all your table names here

// Middleware to validate table names
function validateTable(req, res, next) {
    const { table } = req.params;
    if (!allowedTables.includes(table)) {
        return res.status(400).json({ error: 'Invalid table name' });
    }
    next();
}

// Test database connection on startup
pool.query('SELECT 1', (err) => {
    if (err) {
        console.error('Failed to connect to the database:', err);
        process.exit(1);
    } else {
        console.log('Database connection successful');
    }
});

// Dynamic GET for all records in any table
app.get('/:table', validateTable, (req, res) => {
    const { table } = req.params;
    pool.query(`SELECT * FROM ??`, [table], (err, rows) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: `Failed to fetch from ${table}` });
        }
        res.json(rows);
    });
});

// Dynamic GET for a specific record in any table
app.get('/:table/:id', validateTable, (req, res) => {
    const { table, id } = req.params;
    pool.query(`SELECT * FROM ?? WHERE id = ?`, [table, id], (err, rows) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: `Failed to fetch from ${table}` });
        }
        res.json(rows[0]);
    });
});

// Dynamic POST to add a new record to any table
app.post('/:table', validateTable, (req, res) => {
    const { table } = req.params;
    const data = req.body;
    pool.query(`INSERT INTO ?? SET ?`, [table, data], (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            return res.status(500).json({ error: `Failed to insert into ${table}` });
        }
        res.json({ message: 'Record added', id: result.insertId });
    });
});

// Dynamic PUT to update a specific record in any table
app.put('/:table/:id', validateTable, (req, res) => {
    const { table, id } = req.params;
    const data = req.body;
    pool.query(`UPDATE ?? SET ? WHERE id = ?`, [table, data, id], (err, result) => {
        if (err) {
            console.error('Error updating data:', err);
            return res.status(500).json({ error: `Failed to update ${table}` });
        }
        res.json({ message: 'Record updated' });
    });
});

// Dynamic DELETE to remove a specific record in any table
app.delete('/:table/:id', validateTable, (req, res) => {
    const { table, id } = req.params;
    pool.query(`DELETE FROM ?? WHERE id = ?`, [table, id], (err, result) => {
        if (err) {
            console.error('Error deleting data:', err);
            return res.status(500).json({ error: `Failed to delete from ${table}` });
        }
        res.json({ message: 'Record deleted' });
    });
});

// Graceful shutdown and pool closure
process.on('SIGINT', () => {
    console.log('\nGracefully shutting down...');
    pool.end((err) => {
        if (err) {
            console.error('Error closing the pool:', err);
        } else {
            console.log('Database pool closed.');
        }
        process.exit();
    });
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
