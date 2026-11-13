import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { Db, MongoClient, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27017");
const dbName = process.env.DB_NAME || "booknook";
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

let db: Db;

const jwks = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).send({ message: "You must be logged in" });
  }

  jwtVerify(token, jwks, { issuer: "booknook", audience: "booknook-api" })
    .then(({ payload }) => {
      req.user = {
        id: String(payload.sub),
        email: String(payload.email),
        name: String(payload.name),
      };
      next();
    })
    .catch(() => {
      res.status(401).send({ message: "Invalid or expired token" });
    });
}

async function connectDb() {
  await client.connect();
  db = client.db(dbName);
  console.log("Connected to MongoDB:", dbName);
}

app.get("/", (req: Request, res: Response) => {
  res.send("BookNook API is running");
});

app.get("/books", async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 0;
    const books = await db
      .collection("books")
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    res.send(books);
  } catch (error) {
    res.status(500).send({ message: "Could not load books" });
  }
});

app.get("/books/:id", async (req: Request, res: Response) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "Invalid book id" });
    }
    const book = await db
      .collection("books")
      .findOne({ _id: new ObjectId(req.params.id) });
    if (!book) {
      return res.status(404).send({ message: "Book not found" });
    }
    res.send(book);
  } catch (error) {
    res.status(500).send({ message: "Could not load the book" });
  }
});

const port = process.env.PORT || 5000;

connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`BookNook server running on port ${port}`);
    });
  })
  .catch((error: Error) => {
    console.log("MongoDB connection failed:", error.message);
    process.exit(1);
  });
