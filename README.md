# BookNook API

Express and MongoDB backend for BookNook, my Programming Hero assignment project. It keeps the books and the borrow records in two collections and checks a BetterAuth JWT on everything that writes.

- Live API: https://booknook-server-72c9.onrender.com

## Routes

| Method | Route | Auth | What it does |
| ------ | ----- | ---- | ------------ |
| GET | /books | public | all books, newest first, `?limit=6` for the home page |
| GET | /books/:id | public | one book |
| POST | /books | JWT | add a book |
| PATCH | /books/:id | JWT | edit a book you added |
| DELETE | /books/:id | JWT | delete a book you added |
| POST | /borrows | JWT | borrow a book, its copies go down by one |
| GET | /borrows | JWT | the borrows belonging to the logged in user |
| DELETE | /borrows/:id | JWT | return a book, its copies go up by one |

## How the login check works

The Next.js side runs BetterAuth and publishes its public keys at `/api/auth/jwks`. This server fetches those keys with `jose` and verifies the token that the client sends as `Authorization: Bearer <token>`. So the two apps never share a secret, and the API only has to know the client's URL (`CLIENT_URL`).

Every book and borrow record also stores the user's email from the token, which is how the edit and delete routes know whether the book belongs to the person asking.

## Copies

Each book keeps `totalCopies` and `copies`. Borrowing uses `$inc` to take one away and returning adds one back, so two people borrowing at the same moment can't overwrite each other's number. Before inserting a borrow the server checks that the user does not already have one for that book, and that at least one copy is left.

## Running it locally

```bash
npm install
cp .env.example .env
npm run dev
```

Environment variables:

- `PORT`: the port to listen on, 5000 by default
- `MONGO_URI` and `DB_NAME`: your MongoDB connection and database name
- `CLIENT_URL`: the Next.js app URL, used to fetch the JWKS and verify tokens

## Deploy

It runs as a Render web service. Build command `npm run build`, start command `npm start`, and the same environment variables as above. Nothing else is needed because the TypeScript is compiled to `dist` during the build.

The free Render instance sleeps when nobody uses it for a while, so the first request after a break can take up to a minute to come back. That is the plan limit, not a bug.

## The other half

Client code and pages: https://github.com/Aniruddha120/BookNook-Client_Side
