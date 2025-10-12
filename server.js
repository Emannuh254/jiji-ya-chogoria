// server.js
import express from 'express';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

const app = express();
const port = 3000;

// Database connection
const connectionString = process.env.DATABASE_URL;
console.log('Connecting to database:', connectionString);

const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false }, // Required for Supabase
  debug: process.env.NODE_ENV !== 'production'
});

// Test database connection
sql`SELECT NOW()`.then(() => {
  console.log('Database connected successfully');
}).catch(err => {
  console.error('Database connection error:', err);
  process.exit(1);
});

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'],
  credentials: true
}));
app.use(express.json());

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Initialize database tables
async function initializeDatabase() {
  try {
    // Create users table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create products table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'in_stock',
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create messages table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database tables:', error);
  }
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Signup
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    console.log('Signup request for:', email);
    
    // Check if user exists
    const existingUser = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await sql`
      INSERT INTO users (name, email, password)
      VALUES (${name}, ${email}, ${hashedPassword})
      RETURNING id, name, email
    `;
    
    console.log('User created successfully:', user[0]);
    res.status(201).json(user[0]);
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    console.log('Login request for:', email);
    
    const user = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (user.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user[0].password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user[0].id, name: user[0].name }, 
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    console.log('Login successful for:', email);
    res.json({ token, user: { id: user[0].id, name: user[0].name } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all products
app.get('/products', async (req, res) => {
  try {
    const products = await sql`
      SELECT p.*, u.name as seller_name
      FROM products p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `;
    res.json(products);
  } catch (error) {
    console.error('Products error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create product
app.post('/products', authenticateToken, async (req, res) => {
  const { title, description, price, status } = req.body;
  const userId = req.user.id;
  
  try {
    const product = await sql`
      INSERT INTO products (title, description, price, status, user_id)
      VALUES (${title}, ${description}, ${price}, ${status}, ${userId})
      RETURNING *
    `;
    res.status(201).json(product[0]);
  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all messages
app.get('/messages', async (req, res) => {
  try {
    const messages = await sql`
      SELECT m.*, u.name as sender_name
      FROM messages m
      JOIN users u ON m.user_id = u.id
      ORDER BY m.created_at ASC
    `;
    res.json(messages);
  } catch (error) {
    console.error('Messages error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create message
app.post('/messages', authenticateToken, async (req, res) => {
  const { content } = req.body;
  const userId = req.user.id;
  
  try {
    const message = await sql`
      INSERT INTO messages (content, user_id)
      VALUES (${content}, ${userId})
      RETURNING *
    `;
    res.status(201).json(message[0]);
  } catch (error) {
    console.error('Message creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server and initialize database
sql`SELECT NOW()`.then(() => {
  console.log('Database connected successfully');
  initializeDatabase().then(() => {
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  });
}).catch(err => {
  console.error('Database connection error:', err);
  process.exit(1);
});