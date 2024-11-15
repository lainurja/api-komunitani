const express = require('express'); 
const { createPool } = require('mysql2');
require('dotenv').config()

const app = express();
const PORT = 4000;

// Parse JSON bodies
app.use(express.json());

const pool = createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'laravel',
});

// Daftar tabel yang diizinkan untuk menghindari SQL injection
const allowedTables = ['users', 'posts', 'comments']; // Tambahkan semua nama tabel Anda di sini

// Middleware untuk memvalidasi nama tabel
function validateTable(req, res, next) {
    const { table } = req.params;
    if (!allowedTables.includes(table)) {
        return res.status(400).json({ error: 'Nama tabel tidak valid' });
    }
    next();
}

// Uji koneksi database saat startup
pool.query('SELECT 1', (err) => {
    if (err) {
        console.error('Gagal terhubung ke database:', err);
        process.exit(1);
    } else {
        console.log('Koneksi database berhasil');
    }
});

// GET dinamis untuk mengambil catatan dari tabel mana pun dengan parameter query
app.get('/:table', validateTable, (req, res) => {
    const { table } = req.params;
    const query = req.query;

    let sql = `SELECT * FROM ??`;
    const params = [table];

    // Bangun klausa WHERE secara dinamis berdasarkan parameter query
    if (Object.keys(query).length > 0) {
        const whereClauses = [];
        for (const [key, value] of Object.entries(query)) {
            whereClauses.push(`${key} = ?`);
            params.push(value);
        }
        sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    pool.query(sql, params, (err, rows) => {
        if (err) {
            console.error('Kesalahan saat menjalankan query:', err);
            return res.status(500).json({ error: `Gagal mengambil dari ${table}` });
        }
        res.json(rows);
    });
});

// GET dinamis untuk mengambil catatan spesifik dari tabel mana pun
app.get('/:table/:id', validateTable, (req, res) => {
    const { table, id } = req.params;
    pool.query(`SELECT * FROM ?? WHERE id = ?`, [table, id], (err, rows) => {
        if (err) {
            console.error('Kesalahan saat menjalankan query:', err);
            return res.status(500).json({ error: `Gagal mengambil dari ${table}` });
        }
        res.json(rows[0]);
    });
});

// POST dinamis untuk menambahkan catatan baru ke tabel mana pun
app.post('/:table', validateTable, (req, res) => {
    const { table } = req.params;
    const data = req.body;
    pool.query(`INSERT INTO ?? SET ?`, [table, data], (err, result) => {
        if (err) {
            console.error('Kesalahan saat memasukkan data:', err);
            return res.status(500).json({ error: `Gagal memasukkan ke ${table}` });
        }
        res.json({ message: 'Catatan ditambahkan', id: result.insertId });
    });
});

// PUT dinamis untuk memperbarui catatan spesifik di tabel mana pun
app.put('/:table/:id', validateTable, (req, res) => {
    const { table, id } = req.params;
    const data = req.body;
    pool.query(`UPDATE ?? SET ? WHERE id = ?`, [table, data, id], (err, result) => {
        if (err) {
            console.error('Kesalahan saat memperbarui data:', err);
            return res.status(500).json({ error: `Gagal memperbarui ${table}` });
        }
        res.json({ message: 'Catatan diperbarui' });
    });
});

// DELETE dinamis untuk menghapus catatan spesifik di tabel mana pun
app.delete('/:table/:id', validateTable, (req, res) => {
    const { table, id } = req.params;
    pool.query(`DELETE FROM ?? WHERE id = ?`, [table, id], (err, result) => {
        if (err) {
            console.error('Kesalahan saat menghapus data:', err);
            return res.status(500).json({ error: `Gagal menghapus dari ${table}` });
        }
        res.json({ message: 'Catatan dihapus' });
    });
});

// Penutupan pool dan shutdown yang baik
process.on('SIGINT', () => {
    console.log('\nMenutup dengan baik...');
    pool.end((err) => {
        if (err) {
            console.error('Kesalahan saat menutup pool:', err);
        } else {
            console.log('Pool database ditutup.');
        }
        process.exit();
    });
});

// Mulai server Express
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
