const express = require('express'); 
const { createPool } = require('mysql2');
require('dotenv').config();
const bcrypt = require('bcrypt');

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

// const pool = createPool({
//     host: 'localhost',
//     port: 3306,
//     user: 'root',
//     password: '',
//     database: 'laravel',
//     });

// Daftar tabel yang diizinkan untuk menghindari SQL injection
const allowedTables = ['users', 'posts', 'comments', 'likes', 'messages', 'shares', 'followers']; // Tambahkan semua nama tabel Anda di sini

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
app.post('/:table', validateTable, async (req, res) => {
    const { table } = req.params;
    const data = req.body;

    // Hash the password before saving it
    if (data.password) {
        try {
            const saltRounds = 10; // You can adjust this value
            data.password = await bcrypt.hash(data.password, saltRounds); // Hash the password
        } catch (error) {
            console.error('Error hashing password:', error);
            return res.status(500).json({ error: 'Failed to hash password' });
        }
    }

    pool.query(`INSERT INTO ?? SET ?`, [table, data], (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            return res.status(500).json({ error: `Failed to insert into ${table}` });
        }
        res.json({ message: 'Record added', id: result.insertId });
    });
});

// POST endpoint for user login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Fetch the user from the database
    pool.query('SELECT * FROM users WHERE email = ?', [email], async (err, rows) => {
        if (err) {
            console.error('Error querying user:', err);
            return res.status(500).json({ error: 'Database query error' });
        }

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = rows[0];

        // Compare the provided password with the hashed password
        try {
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            // Successful login
            res.json({ message: 'Login successful', user });
        } catch (error) {
            console.error('Error comparing passwords:', error);
            return res.status(500).json({ error: 'Error verifying password' });
        }
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

// Tambahkan rute root untuk memberikan panduan penggunaan API
app.get('/', (req, res) => {
    const apiGuide = `
        <h1>Selamat Datang di API</h1>
        <p>Berikut adalah endpoint yang dapat Anda gunakan:</p>
        <ul>
            ${allowedTables.map(
                (table) => `
                <li>
                    <a href="/${table}">/${table}</a> - Mengambil semua data dari tabel <strong>${table}</strong>.
                </li>`
            ).join('')}
        </ul>
        <p>Contoh:</p>
        <ul>
            <li>GET <code>/${allowedTables[0]}</code> - Mengambil semua data dari tabel "${allowedTables[0]}".</li>
            <li>GET <code>/${allowedTables[0]}/:id</code> - Mengambil data berdasarkan ID dari tabel "${allowedTables[0]}".</li>
            <li>POST <code>/${allowedTables[0]}</code> - Menambahkan data baru ke tabel "${allowedTables[0]}".</li>
            <li>PUT <code>/${allowedTables[0]}/:id</code> - Memperbarui data berdasarkan ID di tabel "${allowedTables[0]}".</li>
            <li>DELETE <code>/${allowedTables[0]}/:id</code> - Menghapus data berdasarkan ID dari tabel "${allowedTables[0]}".</li>
        </ul>
        <p>Anda dapat menambahkan parameter query ke endpoint GET untuk memfilter data. Contoh: <code>/${allowedTables[0]}?name=arline&&email=zero@mail.com</code></p>
    `;
    res.send(apiGuide);
});

// Mulai server Express
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});