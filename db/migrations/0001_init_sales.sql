CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    quantity INTEGER NOT NULL,
    date TEXT NOT NULL,
    region TEXT NOT NULL,
    month TEXT NOT NULL
);
