# BookNook Server

Express + MongoDB API for BookNook. Every write route and every borrow route checks the BetterAuth JWT sent as `Authorization: Bearer <token>`.

API URL: https://booknook-server.onrender.com

## Routes

| Method | Route | Auth | What it does |
| ------ | ----- | ---- | ------------ |
| GET | /books | public | all books, newest first (`?limit=6` for the home page) |
| GET | /books/:id | public | one book |
| POST | /books | JWT | add a book |
| PATCH | /books/:id | JWT | edit your own book |
| DELETE | /books/:id | JWT | delete your own book |
| POST | /borrows | JWT | borrow a book, copies decrease by 1 |
| GET | /borrows | JWT | your borrows |
| DELETE | /borrows/:id | JWT | return a book, copies increase by 1 |

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Environment variables:

- `PORT` – server port
- `MONGO_URI` – MongoDB connection string
- `DB_NAME` – database name
- `CLIENT_URL` – Next.js app URL, used to read the BetterAuth JWKS

## Deploy

Render web service: build command `npm install`, start command `npm start`, and the same environment variables.

Client side: https://github.com/Aniruddha120/BookNook-Client_Side
